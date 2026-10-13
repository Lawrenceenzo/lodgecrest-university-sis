const express = require('express');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Course = require('../models/Course');
const { purgeStudentRecords } = require('../services/cleanup');
const { ACADEMIC_STATUSES } = Student;
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { generateTempPassword } = require('../utils/password');
const { uploadPhoto, publicPath, removeUpload } = require('../middleware/upload');

const router = express.Router();
router.use(authenticate, requireRole('admin')); // student records are managed by admins only

// Only these fields can be written by clients (blocks overriding _id/createdAt).
const WRITABLE_FIELDS = [
  'studentId', 'firstName', 'middleName', 'lastName', 'suffix', 'dob', 'gender',
  'civilStatus', 'nationality', 'religion', 'email', 'contactNumber', 'address',
  'emergencyContact', 'course', 'yearLevel', 'section', 'status',
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fullName = (s) => [s.firstName, s.lastName].filter(Boolean).join(' ');
const notFound = (res) => res.status(404).json({ message: 'Student not found' });

// Copy only known fields, and only plain strings (or the emergencyContact pair), so a
// client can't smuggle Mongo operators like { "$gt": "" } into a query or update.
// `profilePicture` is deliberately not writable here: it is set only from an uploaded file.
// The emergency contact arrives as an object (JSON requests) or as two flat fields
// (multipart form requests, which cannot nest objects).
function pickWritable(body = {}) {
  const out = {};
  for (const key of WRITABLE_FIELDS) {
    const value = body[key];
    if (key === 'emergencyContact') {
      if (value && typeof value === 'object') {
        out.emergencyContact = {
          name: typeof value.name === 'string' ? value.name.trim() : '',
          phone: typeof value.phone === 'string' ? value.phone.trim() : '',
        };
      } else if (typeof body.emergencyContactName === 'string' || typeof body.emergencyContactPhone === 'string') {
        out.emergencyContact = {
          name: typeof body.emergencyContactName === 'string' ? body.emergencyContactName.trim() : '',
          phone: typeof body.emergencyContactPhone === 'string' ? body.emergencyContactPhone.trim() : '',
        };
      }
    } else if (typeof value === 'string') {
      out[key] = value.trim();
    }
  }
  return out;
}

// Keeps Student.program (the link to the Course record) in step with the course code that was sent.
// Returns an error message, or null. Mutates `data`.
async function resolveProgram(data) {
  if (!('course' in data)) return null;
  if (!data.course) {
    data.program = null;
    return null;
  }
  const course = await Course.findOne({ code: data.course }).select('_id');
  if (!course) return `course "${data.course}" is not in the course catalog`;
  data.program = course._id;
  return null;
}

// Next id for the current year: 2026-0001, 2026-0002, ...
async function generateStudentId() {
  const year = new Date().getFullYear();
  const last = await Student.findOne({ studentId: new RegExp(`^${year}-`) }).sort({ studentId: -1 });
  const next = last ? parseInt(last.studentId.split('-')[1], 10) + 1 : 1;
  return `${year}-${String(next).padStart(4, '0')}`;
}

// Hidden from the default list: records that are closed or moved elsewhere.
const HIDDEN_BY_DEFAULT = ['Archived', 'Transferred'];

// GET /api/students?search=&course=&yearLevel=&section=&status=&includeInactive=true&academicStatus=
//   default                -> everyone except Archived and Transferred students
//   includeInactive=true   -> everyone
//   academicStatus=Archived -> only that status (always honoured)
router.get('/', async (req, res) => {
  const filter = {};
  for (const key of ['course', 'yearLevel', 'section', 'status']) {
    if (typeof req.query[key] === 'string' && req.query[key]) filter[key] = req.query[key];
  }

  if (ACADEMIC_STATUSES.includes(req.query.academicStatus)) filter.academicStatus = req.query.academicStatus;
  else if (req.query.includeInactive !== 'true') filter.academicStatus = { $nin: HIDDEN_BY_DEFAULT };

  // Every word must match at least one of the searchable fields.
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const words = req.query.search.trim().split(/\s+/).slice(0, 5);
    filter.$and = words.map((word) => {
      const rx = new RegExp(escapeRegex(word), 'i');
      return { $or: ['studentId', 'firstName', 'middleName', 'lastName', 'course'].map((f) => ({ [f]: rx })) };
    });
  }

  res.json(await Student.find(filter).sort({ studentId: 1 }));
});

// GET /api/students/:id
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const student = await Student.findById(req.params.id);
  if (!student) return notFound(res);
  res.json(student);
});

// POST /api/students  (JSON, or multipart/form-data with an optional "photo" file)
router.post('/', uploadPhoto, async (req, res) => {
  const data = pickWritable(req.body);
  if (req.file) data.profilePicture = publicPath(req.file);

  const programProblem = await resolveProgram(data);
  if (programProblem) {
    await removeUpload(data.profilePicture);
    return res.status(400).json({ message: 'Validation failed', errors: [programProblem] });
  }

  try {
    // An auto-generated id can collide if two students are added at the same moment; retry.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const student = await Student.create({ ...data, studentId: data.studentId || (await generateStudentId()) });
        return res.status(201).json(student);
      } catch (err) {
        const autoId = !data.studentId;
        if (!(err.code === 11000 && autoId && attempt < 2)) throw err;
      }
    }
  } catch (err) {
    await removeUpload(data.profilePicture); // don't leave an orphaned photo if the save failed
    throw err;
  }
});

// PUT /api/students/:id  (partial updates are fine; JSON, or multipart with a "photo" file;
// send removePhoto=true to delete the current photo)
// Changing the e-mail also changes the student's portal login e-mail (see syncPortalLogin).
router.put('/:id', uploadPhoto, async (req, res) => {
  const newPhoto = req.file ? publicPath(req.file) : '';

  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      await removeUpload(newPhoto);
      return notFound(res);
    }
    const existing = await Student.findById(req.params.id).select('profilePicture academicStatus email');
    if (!existing) {
      await removeUpload(newPhoto);
      return notFound(res);
    }
    if (existing.academicStatus === 'Archived') {
      await removeUpload(newPhoto);
      return res.status(409).json({ message: 'This record is archived. Restore it before making changes.' });
    }

    const data = pickWritable(req.body);
    if (newPhoto) data.profilePicture = newPhoto;
    else if (req.body?.removePhoto === 'true') data.profilePicture = '';

    const programProblem = await resolveProgram(data);
    if (programProblem) {
      await removeUpload(newPhoto);
      return res.status(400).json({ message: 'Validation failed', errors: [programProblem] });
    }

    // If the e-mail is changing and the student has a login, make sure the new address is free
    // BEFORE touching anything, so the two records can't end up disagreeing.
    const account = typeof data.email === 'string' ? await User.findOne({ student: existing._id }) : null;
    const newLoginEmail = account && data.email ? data.email.toLowerCase() : null;
    const loginEmailChanges = Boolean(newLoginEmail && newLoginEmail !== account.email);
    if (loginEmailChanges && (await User.exists({ email: newLoginEmail, _id: { $ne: account._id } }))) {
      await removeUpload(newPhoto);
      return res.status(409).json({ message: 'Another account already uses that e-mail address, so it cannot be used for this student.' });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    );
    if (!student) {
      await removeUpload(newPhoto);
      return notFound(res);
    }

    // Keep the portal login in step with the student record.
    let portalLoginUpdated = false;
    if (account) {
      try {
        portalLoginUpdated = await syncPortalLogin(account, student, loginEmailChanges);
      } catch (err) {
        // Could not update the login (e.g. someone grabbed the address a moment ago): undo the student change.
        await Student.updateOne({ _id: student._id }, { $set: { email: existing.email } });
        throw err;
      }
    }

    // The old photo is no longer referenced once it has been replaced or removed.
    if ('profilePicture' in data && existing.profilePicture !== data.profilePicture) {
      await removeUpload(existing.profilePicture);
    }
    res.json(portalLoginUpdated ? { ...student.toJSON(), portalLoginUpdated: true } : student);
  } catch (err) {
    await removeUpload(newPhoto);
    throw err;
  }
});

// Brings a student's portal login in line with their record: display name, and (when the e-mail
// changed) the sign-in e-mail. A new e-mail receives all future verification codes, so the change
// also signs the student out everywhere and discards any code already sent to the old address.
// Returns true if the login e-mail changed.
async function syncPortalLogin(account, student, emailChanged) {
  const name = fullName(student);
  if (!emailChanged) {
    if (name && name !== account.name) await User.updateOne({ _id: account._id }, { $set: { name } });
    return false;
  }
  await User.updateOne(
    { _id: account._id },
    {
      $set: { email: student.email.toLowerCase(), name: name || account.name, otpAttempts: 0 },
      $inc: { tokenVersion: 1 }, // signs the student out everywhere
      $unset: { otp: 1, otpExpires: 1 },
    },
  );
  return true;
}

// ---------------------------------------------------------------------------------------------
// Lifecycle: archive (soft delete), restore, change academic status, permanent delete.
// ---------------------------------------------------------------------------------------------

// DELETE /api/students/:id
//   (default)                         -> SOFT delete: the student is archived, nothing is lost
//   ?permanent=true&confirm=<number>  -> irreversible; only for an already-archived student, and
//                                        only when `confirm` equals the student number
router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const student = await Student.findById(req.params.id);
  if (!student) return notFound(res);

  if (req.query.permanent !== 'true') {
    if (student.academicStatus !== 'Archived') {
      student.statusBeforeArchive = student.academicStatus;
      student.academicStatus = 'Archived';
      student.archivedAt = new Date();
      await student.save();
    }
    return res.json({ message: 'Student archived', student });
  }

  if (student.academicStatus !== 'Archived') {
    return res.status(409).json({ message: 'Archive this student first. Only archived records can be permanently deleted.' });
  }
  if (req.query.confirm !== student.studentId) {
    return res.status(400).json({ message: `To confirm, enter the student number (${student.studentId}).` });
  }

  // Everything that belongs to the student goes with them: grades, attendance, enrollments (their
  // seats are returned to the classes), charges, payments, holds, and the portal login.
  const recordsRemoved = await purgeStudentRecords(student._id);
  await Student.deleteOne({ _id: student._id });
  await User.deleteMany({ student: student._id });
  await removeUpload(student.profilePicture);
  res.json({ message: 'Student permanently deleted', recordsRemoved });
});

// POST /api/students/:id/restore  -> un-archive, back to the status they had before
router.post('/:id/restore', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const student = await Student.findById(req.params.id);
  if (!student) return notFound(res);
  if (student.academicStatus !== 'Archived') return res.status(409).json({ message: 'This student is not archived.' });

  student.academicStatus = student.statusBeforeArchive || 'Enrolled';
  student.statusBeforeArchive = '';
  student.archivedAt = undefined;
  await student.save();
  res.json(student);
});

// PATCH /api/students/:id/academic-status  { academicStatus }
// Enrolled | LOA | Transferred | Graduated. (Archiving goes through DELETE so it is always deliberate.)
router.patch('/:id/academic-status', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const next = req.body?.academicStatus;
  if (!ACADEMIC_STATUSES.includes(next) || next === 'Archived') {
    return res.status(400).json({ message: 'academicStatus must be Enrolled, LOA, Transferred or Graduated (to archive a student, use DELETE).' });
  }
  const student = await Student.findById(req.params.id);
  if (!student) return notFound(res);

  student.academicStatus = next;
  student.statusBeforeArchive = '';
  student.archivedAt = undefined;
  await student.save();
  res.json(student);
});

// ---------------------------------------------------------------------------------------------
// Student portal accounts. A student signs in with their own e-mail; an admin creates the login
// and hands over a one-time temporary password, which must be changed at first sign-in.
// ---------------------------------------------------------------------------------------------
const noStore = (res) => res.set('Cache-Control', 'no-store'); // passwords must never be cached

// GET /api/students/:id/account  -> does this student have a login?
router.get('/:id/account', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const account = await User.findOne({ student: req.params.id });
  res.json(account ? { exists: true, email: account.email, mustChangePassword: account.mustChangePassword, createdAt: account.createdAt } : { exists: false });
});

// POST /api/students/:id/account  -> create the login; the temporary password is shown ONCE
router.post('/:id/account', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const student = await Student.findById(req.params.id);
  if (!student) return notFound(res);
  if (!student.email) return res.status(400).json({ message: 'This student has no e-mail address on file' });

  if (await User.exists({ student: student._id })) {
    return res.status(409).json({ message: 'This student already has a portal account' });
  }
  const email = student.email.trim().toLowerCase();
  if (await User.exists({ email })) {
    return res.status(409).json({ message: 'Another account already uses this e-mail address' });
  }

  const temporaryPassword = generateTempPassword();
  const user = await User.create({
    name: fullName(student),
    email,
    password: await bcrypt.hash(temporaryPassword, 10),
    role: 'student',
    student: student._id,
    mustChangePassword: true,
  });
  noStore(res);
  res.status(201).json({ account: { exists: true, email: user.email, mustChangePassword: true, createdAt: user.createdAt }, temporaryPassword });
});

// POST /api/students/:id/account/reset-password  -> new temporary password (signs the student out)
router.post('/:id/account/reset-password', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const user = await User.findOne({ student: req.params.id });
  if (!user) return res.status(404).json({ message: 'This student has no portal account yet' });

  const temporaryPassword = generateTempPassword();
  user.password = await bcrypt.hash(temporaryPassword, 10);
  user.mustChangePassword = true;
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // invalidates their existing sessions
  await user.save();
  noStore(res);
  res.json({ temporaryPassword });
});

module.exports = router;

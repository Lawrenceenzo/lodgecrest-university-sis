// The catalog an administrator maintains: courses, subjects, teachers and sections.
// Every list is read from MongoDB on each request, and every change is written there, so nothing
// lives only in the browser. Admin-only.

const express = require('express');
const mongoose = require('mongoose');
const { Student, Course, Subject, Teacher, Section, Offering, Enrollment, Grade } = require('../models');
const { SEMESTERS } = require('../models/_shared');
const { YEAR_LEVELS, SECTIONS } = Student;
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');

const router = express.Router();
router.use(['/courses', '/subjects', '/teachers', '/sections', '/dashboard'], authenticate, requireRole('admin'));

const validId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id);
const notFound = (res, what) => res.status(404).json({ message: `${what} not found` });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bad = (res, ...errors) => res.status(400).json({ message: 'Validation failed', errors });
const conflict = (res, message) => res.status(409).json({ message });
const str = (v) => (typeof v === 'string' ? v.trim() : undefined);
const INACTIVE = ['Archived', 'Transferred'];

// A code that differs from an existing one only by letters' case is the same code.
const sameCode = (code) => new RegExp(`^${escapeRegex(code)}$`, 'i');

// Number from a form field ("4") or a JSON number; undefined when absent, NaN when not a number.
function num(v) {
  if (v === undefined || v === null || v === '') return undefined;
  return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
}

// ---------------------------------------------------------------------------------------------
// Dashboard totals
// ---------------------------------------------------------------------------------------------

// GET /api/dashboard/stats -> the headline counts, straight from the collections on every request.
//   students: enrolled-in-the-system students (archived and transferred ones are not counted, the same
//   rule as the default Students list), teachers / courses / sections: every record saved.
router.get('/dashboard/stats', async (req, res) => {
  const [students, teachers, activeTeachers, courses, sections] = await Promise.all([
    Student.countDocuments({ academicStatus: { $nin: INACTIVE } }),
    Teacher.countDocuments(),
    Teacher.countDocuments({ status: 'Active' }),
    Course.countDocuments(),
    Section.countDocuments(),
  ]);
  res.set('Cache-Control', 'no-store'); // a count that is a minute old is a wrong count
  res.json({ students, teachers, activeTeachers, courses, sections });
});

// ---------------------------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------------------------
const courseJson = (c, students = 0) => ({ id: String(c._id), code: c.code, name: c.name, department: c.department, years: c.years, totalUnits: c.totalUnits, active: c.active, students });

// GET /api/courses -> every course with how many active students it has
router.get('/courses', async (req, res) => {
  const [courses, counts] = await Promise.all([
    Course.find().sort({ code: 1 }),
    Student.aggregate([{ $match: { course: { $ne: '' }, academicStatus: { $nin: INACTIVE } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
  ]);
  const byCode = new Map(counts.map((c) => [c._id, c.n]));
  res.json(courses.map((c) => courseJson(c, byCode.get(c.code) ?? 0)));
});

// POST /api/courses  { code, name, department, years, totalUnits }
router.post('/courses', async (req, res) => {
  const { code, name, department } = { code: str(req.body?.code), name: str(req.body?.name), department: str(req.body?.department) };
  const years = num(req.body?.years);
  const totalUnits = num(req.body?.totalUnits);
  if (!code || !name) return bad(res, ...[!code && 'code is required', !name && 'name is required'].filter(Boolean));
  if (Number.isNaN(years) || Number.isNaN(totalUnits)) return bad(res, 'years and totalUnits must be numbers');
  if (await Course.exists({ code: sameCode(code) })) return conflict(res, `A course with code ${code} already exists`);
  const course = await Course.create({ code, name, department, ...(years !== undefined && { years }), totalUnits });
  return res.status(201).json(courseJson(course, 0));
});

// PUT /api/courses/:id  { name, department, years, totalUnits, active }  (the code never changes: students carry it)
router.put('/courses/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Course');
  const course = await Course.findById(req.params.id);
  if (!course) return notFound(res, 'Course');
  const code = str(req.body?.code);
  if (code && code !== course.code) return bad(res, 'code cannot be changed: students and subjects refer to it');

  for (const key of ['name', 'department']) if (str(req.body?.[key]) !== undefined) course[key] = str(req.body[key]);
  for (const key of ['years', 'totalUnits']) {
    const v = num(req.body?.[key]);
    if (Number.isNaN(v)) return bad(res, `${key} must be a number`);
    if (v !== undefined) course[key] = v;
  }
  if (typeof req.body?.active === 'boolean') course.active = req.body.active;
  await course.save();
  return res.json(courseJson(course, await Student.countDocuments({ course: course.code, academicStatus: { $nin: INACTIVE } })));
});

// DELETE /api/courses/:id -> only a course nothing refers to
router.delete('/courses/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Course');
  const course = await Course.findById(req.params.id);
  if (!course) return notFound(res, 'Course');
  const [students, sections, subjects] = await Promise.all([
    Student.countDocuments({ $or: [{ program: course._id }, { course: course.code }] }),
    Section.countDocuments({ course: course._id }),
    Subject.countDocuments({ 'curriculum.course': course._id }),
  ]);
  const uses = [students && `${students} student${students === 1 ? '' : 's'}`, sections && `${sections} section${sections === 1 ? '' : 's'}`, subjects && `${subjects} subject${subjects === 1 ? '' : 's'}`].filter(Boolean);
  if (uses.length) return conflict(res, `${course.code} is still used by ${uses.join(', ')}, so it cannot be deleted. You can mark it inactive instead.`);
  await course.deleteOne();
  return res.json({ message: 'Course deleted' });
});

// ---------------------------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------------------------
const POPULATE_SUBJECT = [{ path: 'prerequisites', select: 'code' }, { path: 'curriculum.course', select: 'code' }];

const subjectJson = (s) => ({
  id: String(s._id),
  code: s.code,
  title: s.title,
  units: s.units,
  countsToGwa: s.countsToGwa,
  description: s.description,
  prerequisites: s.prerequisites.map((p) => p.code),
  curriculum: s.curriculum.map((c) => ({ course: c.course?.code ?? '', yearLevel: c.yearLevel, semester: c.semester })),
});

// "IT101, IT102" (or ["IT101"]) -> subject ids. Returns { ids } or { error }.
async function resolvePrerequisites(input, selfCode) {
  if (input === undefined) return { ids: undefined };
  const codes = (Array.isArray(input) ? input : String(input).split(/[\s,;]+/)).map((c) => String(c).trim()).filter(Boolean);
  if (selfCode && codes.some((c) => c.toLowerCase() === selfCode.toLowerCase())) return { error: 'a subject cannot be its own prerequisite' };
  const found = await Subject.find({ code: { $in: codes.map(sameCode) } }).select('code');
  const missing = codes.filter((c) => !found.some((f) => f.code.toLowerCase() === c.toLowerCase()));
  if (missing.length) return { error: `prerequisite ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not in the subject catalog` };
  return { ids: found.map((f) => f._id) };
}

// GET /api/subjects
router.get('/subjects', async (req, res) => {
  res.json((await Subject.find().sort({ code: 1 }).populate(POPULATE_SUBJECT)).map(subjectJson));
});

// POST /api/subjects  { code, title, units, course ('ALL' or a code), yearLevel, semester, prerequisites?, countsToGwa?, description? }
router.post('/subjects', async (req, res) => {
  const b = req.body || {};
  const code = str(b.code);
  const title = str(b.title);
  const units = num(b.units);
  const errors = [!code && 'code is required', !title && 'title is required', (units === undefined || Number.isNaN(units)) && 'units is required'].filter(Boolean);
  const course = str(b.course);
  if (!course) errors.push('course is required');
  if (!YEAR_LEVELS.includes(b.yearLevel)) errors.push('yearLevel is invalid');
  if (!SEMESTERS.includes(b.semester)) errors.push('semester is invalid');
  if (errors.length) return bad(res, ...errors);
  if (await Subject.exists({ code: sameCode(code) })) return conflict(res, `A subject with code ${code} already exists`);

  const courses = /^(all|all courses)$/i.test(course) ? await Course.find().select('_id') : await Course.find({ code: sameCode(course) }).select('_id');
  if (courses.length === 0) return bad(res, `course "${course}" is not in the course catalog`);
  const pre = await resolvePrerequisites(b.prerequisites, code);
  if (pre.error) return bad(res, pre.error);

  const subject = await Subject.create({
    code,
    title,
    units,
    countsToGwa: b.countsToGwa === false || b.countsToGwa === 'false' ? false : true,
    description: str(b.description) ?? '',
    prerequisites: pre.ids ?? [],
    curriculum: courses.map((c) => ({ course: c._id, yearLevel: b.yearLevel, semester: b.semester })),
  });
  return res.status(201).json(subjectJson(await subject.populate(POPULATE_SUBJECT)));
});

// PUT /api/subjects/:id  { title, units, prerequisites, countsToGwa, description }  (code and placements stay as created)
router.put('/subjects/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Subject');
  const subject = await Subject.findById(req.params.id);
  if (!subject) return notFound(res, 'Subject');
  const b = req.body || {};
  if (str(b.code) && str(b.code) !== subject.code) return bad(res, 'code cannot be changed: classes and grades refer to it');

  if (str(b.title) !== undefined) subject.title = str(b.title);
  const units = num(b.units);
  if (Number.isNaN(units)) return bad(res, 'units must be a number');
  if (units !== undefined) subject.units = units;
  if (typeof b.countsToGwa === 'boolean') subject.countsToGwa = b.countsToGwa;
  if (str(b.description) !== undefined) subject.description = str(b.description);
  const pre = await resolvePrerequisites(b.prerequisites, subject.code);
  if (pre.error) return bad(res, pre.error);
  if (pre.ids) subject.prerequisites = pre.ids;
  await subject.save();
  return res.json(subjectJson(await subject.populate(POPULATE_SUBJECT)));
});

// DELETE /api/subjects/:id -> only a subject nothing refers to
router.delete('/subjects/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Subject');
  const subject = await Subject.findById(req.params.id);
  if (!subject) return notFound(res, 'Subject');
  const [offerings, enrollments, grades, dependents] = await Promise.all([
    Offering.countDocuments({ subject: subject._id }),
    Enrollment.countDocuments({ subject: subject._id }),
    Grade.countDocuments({ subject: subject._id }),
    Subject.countDocuments({ prerequisites: subject._id }),
  ]);
  const uses = [offerings && `${offerings} class${offerings === 1 ? '' : 'es'}`, enrollments && `${enrollments} enrollment${enrollments === 1 ? '' : 's'}`, grades && `${grades} grade${grades === 1 ? '' : 's'}`, dependents && `${dependents} subject${dependents === 1 ? '' : 's'} that require it`].filter(Boolean);
  if (uses.length) return conflict(res, `${subject.code} is still used by ${uses.join(', ')}, so it cannot be deleted.`);
  await subject.deleteOne();
  return res.json({ message: 'Subject deleted' });
});

// ---------------------------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------------------------
const teacherJson = (t) => ({ id: String(t._id), employeeId: t.employeeId, name: t.name, department: t.department, email: t.email, contactNumber: t.contactNumber, status: t.status });

// EMP-0001, EMP-0002, ... one past the highest in use
async function nextEmployeeId() {
  const last = await Teacher.findOne().sort({ employeeId: -1 }).select('employeeId');
  const n = last ? parseInt(last.employeeId.slice(4), 10) + 1 : 1;
  return `EMP-${String(n).padStart(4, '0')}`;
}

// Is this e-mail already on a teacher record? `exceptId` leaves out the teacher being edited, so saving a
// teacher with their own unchanged address is fine. The comparison ignores letter case and spaces.
const DUPLICATE_EMAIL = 'That email address is already used by another teacher.';
const teacherEmailTaken = (email, exceptId) =>
  Teacher.exists({ email: String(email).trim().toLowerCase(), ...(exceptId && { _id: { $ne: exceptId } }) });
const isEmailDuplicateError = (err) => err.code === 11000 && 'email' in (err.keyPattern || {});

// GET /api/teachers
router.get('/teachers', async (req, res) => {
  res.json((await Teacher.find().sort({ name: 1 })).map(teacherJson));
});

// POST /api/teachers  { name, department, email, contactNumber? }  (the employee id is assigned here)
router.post('/teachers', async (req, res) => {
  const b = req.body || {};
  if (str(b.email) && (await teacherEmailTaken(b.email))) return bad(res, DUPLICATE_EMAIL);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const teacher = await Teacher.create({ employeeId: await nextEmployeeId(), name: str(b.name), department: str(b.department), email: str(b.email), contactNumber: str(b.contactNumber) ?? '' });
      return res.status(201).json(teacherJson(teacher));
    } catch (err) {
      if (isEmailDuplicateError(err)) return bad(res, DUPLICATE_EMAIL); // two requests with the same address at once
      // two teachers added at the same instant can pick the same number: try the next one
      if (!(err.code === 11000 && 'employeeId' in (err.keyPattern || {}) && attempt < 2)) throw err;
    }
  }
  return undefined;
});

// PUT /api/teachers/:id  { name, department, email, contactNumber, status }  (the employee id never changes)
router.put('/teachers/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Teacher');
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) return notFound(res, 'Teacher');
  const b = req.body || {};
  if (str(b.employeeId) && str(b.employeeId) !== teacher.employeeId) return bad(res, 'employeeId cannot be changed');
  if (str(b.email) && (await teacherEmailTaken(b.email, teacher._id))) return bad(res, DUPLICATE_EMAIL);
  for (const key of ['name', 'department', 'email', 'contactNumber', 'status']) if (str(b[key]) !== undefined) teacher[key] = str(b[key]);
  if (teacher.status === 'Inactive' && (await Section.exists({ adviser: teacher._id }))) {
    return conflict(res, `${teacher.name} still advises a section. Give that section another adviser first.`);
  }
  try {
    await teacher.save();
  } catch (err) {
    if (isEmailDuplicateError(err)) return bad(res, DUPLICATE_EMAIL); // someone took the address a moment ago
    throw err;
  }
  return res.json(teacherJson(teacher));
});

// DELETE /api/teachers/:id -> not while they advise a section
router.delete('/teachers/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Teacher');
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) return notFound(res, 'Teacher');
  const advised = await Section.countDocuments({ adviser: teacher._id });
  if (advised) return conflict(res, `${teacher.name} advises ${advised} section${advised === 1 ? '' : 's'}. Give them another adviser first.`);
  await teacher.deleteOne();
  return res.json({ message: 'Teacher deleted' });
});

// ---------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------
const POPULATE_SECTION = [{ path: 'course', select: 'code name' }, { path: 'adviser', select: 'name employeeId' }];

async function sectionRows(docs) {
  const counts = await Student.aggregate([
    { $match: { course: { $ne: '' }, section: { $ne: '' }, academicStatus: { $nin: INACTIVE } } },
    { $group: { _id: { course: '$course', yearLevel: '$yearLevel', section: '$section' }, n: { $sum: 1 } } },
  ]);
  const key = (c, y, s) => `${c}|${y}|${s}`;
  const byKey = new Map(counts.map((c) => [key(c._id.course, c._id.yearLevel, c._id.section), c.n]));
  return docs.map((s) => ({
    id: String(s._id),
    name: `${s.course.code}-${s.yearLevel[0]}${s.name}`,
    course: s.course.code,
    courseName: s.course.name,
    yearLevel: s.yearLevel,
    section: s.name,
    adviser: s.adviser?.name ?? '',
    adviserId: s.adviser ? String(s.adviser._id) : '',
    capacity: s.capacity,
    students: byKey.get(key(s.course.code, s.yearLevel, s.name)) ?? 0,
  }));
}

async function activeAdviser(id) {
  if (!validId(id)) return { error: 'adviser is required' };
  const teacher = await Teacher.findById(id);
  if (!teacher) return { error: 'adviser is not in the teacher list' };
  if (teacher.status !== 'Active') return { error: `${teacher.name} is inactive and cannot advise a section` };
  return { teacher };
}

// GET /api/sections
router.get('/sections', async (req, res) => {
  const docs = await Section.find().populate(POPULATE_SECTION);
  const rows = await sectionRows(docs);
  res.json(rows.sort((a, b) => a.name.localeCompare(b.name)));
});

// POST /api/sections  { course (code), yearLevel, section, adviserId, capacity? }
router.post('/sections', async (req, res) => {
  const b = req.body || {};
  const errors = [];
  const course = str(b.course) ? await Course.findOne({ code: sameCode(str(b.course)) }) : null;
  if (!course) errors.push('course is not in the course catalog');
  if (!YEAR_LEVELS.includes(b.yearLevel)) errors.push('yearLevel is invalid');
  if (!SECTIONS.includes(b.section)) errors.push('section is invalid');
  const { teacher, error } = await activeAdviser(b.adviserId);
  if (error) errors.push(error);
  const capacity = num(b.capacity);
  if (Number.isNaN(capacity)) errors.push('capacity must be a number');
  if (errors.length) return bad(res, ...errors);

  const section = await Section.create({ course: course._id, yearLevel: b.yearLevel, name: b.section, adviser: teacher._id, ...(capacity !== undefined && { capacity }) });
  return res.status(201).json((await sectionRows([await section.populate(POPULATE_SECTION)]))[0]);
});

// PUT /api/sections/:id  { adviserId, capacity }  (course, year and letter identify the section and stay)
router.put('/sections/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Section');
  const section = await Section.findById(req.params.id);
  if (!section) return notFound(res, 'Section');
  const b = req.body || {};
  if (b.adviserId !== undefined) {
    const { teacher, error } = await activeAdviser(b.adviserId);
    if (error) return bad(res, error);
    section.adviser = teacher._id;
  }
  const capacity = num(b.capacity);
  if (Number.isNaN(capacity)) return bad(res, 'capacity must be a number');
  if (capacity !== undefined) section.capacity = capacity;
  await section.save();
  return res.json((await sectionRows([await section.populate(POPULATE_SECTION)]))[0]);
});

// DELETE /api/sections/:id -> only an empty section
router.delete('/sections/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Section');
  const section = await Section.findById(req.params.id).populate(POPULATE_SECTION);
  if (!section) return notFound(res, 'Section');
  const [row] = await sectionRows([section]);
  if (row.students > 0) return conflict(res, `${row.name} still has ${row.students} student${row.students === 1 ? '' : 's'}, so it cannot be deleted.`);
  await section.deleteOne();
  return res.json({ message: 'Section deleted' });
});

module.exports = router;

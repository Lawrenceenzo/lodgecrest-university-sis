// Sample enrollments and grades for a student who has none, so the student portal (schedule, units,
// grades) has something real to show. An administrator asks for it explicitly: it is demo data.
//
//   current term  -> the standard subjects of the student's program, year level and the current semester
//   history       -> every earlier semester of the program, completed, with grades
//
// Classes are real Offerings and Enrollments (seats are counted), found or created for the student's
// section, with times that never overlap each other. Nothing is overwritten: terms the student already
// has records in are skipped, so running it twice adds nothing.

const { Student, Course, Term, Subject, Offering, Enrollment, Grade } = require('../models');
const { EnrollmentError } = require('./enrollment');
const { clearAcademicRecords } = require('./cleanup');
const { offeringsConflict } = require('./schedule');
const { makeRng, PROFESSORS, TIME_SLOTS } = require('../config/timetable');

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SEMESTERS = ['1st Semester', '2nd Semester'];
const GRADE_POOL = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75];

const slotSubjects = (program, yearLevel, semester) =>
  Subject.find({ curriculum: { $elemMatch: { course: program._id, yearLevel, semester } } }).sort({ code: 1 });

// Times for a new class: Saturday for NSTP, otherwise the first weekly slot that does not clash with `picked`.
function chooseMeetings(subject, studentId, picked) {
  if (subject.code.startsWith('NSTP')) return [{ day: 'Sat', start: '08:00', end: '11:00', room: 'Gym Annex' }];
  const start = Math.floor(makeRng(`slot|${studentId}|${subject.code}`)() * TIME_SLOTS.length);
  for (let i = 0; i < TIME_SLOTS.length; i += 1) {
    const slot = TIME_SLOTS[(start + i) % TIME_SLOTS.length];
    const room = `Rm ${200 + Math.floor(makeRng(`room|${subject.code}`)() * 40)}`;
    const meetings = slot.days.map((day) => ({ day, start: slot.time[0], end: slot.time[1], room }));
    if (!picked.some((o) => offeringsConflict(o, { meetings }))) return meetings;
  }
  return [{ day: 'Sat', start: '13:00', end: '16:00', room: 'Rm 301' }]; // everything weekday clashes: still a valid class
}

async function takeSeat(offeringId) {
  return Offering.findOneAndUpdate({ _id: offeringId, status: 'Open', $expr: { $lt: ['$enrolledCount', '$capacity'] } }, { $inc: { enrolledCount: 1 } }, { returnDocument: 'after' });
}

// Put the student in one class of this subject and term: an existing section that fits, or a new one.
// Returns { offering, enrollment }.
async function placeInSubject({ student, term, subject, status, picked }) {
  const existing = await Offering.find({ term: term._id, subject: subject._id }).sort({ section: 1 });
  // Only the student's own section: a student in Section A does not drift into Section B's classes.
  const ordered = existing.filter((o) => o.section === student.section);

  const attempt = async (offering) => {
    const seat = await takeSeat(offering._id);
    if (!seat) return null;
    try {
      return { offering: seat, enrollment: await Enrollment.create({ student: student._id, offering: offering._id, status }) };
    } catch (err) {
      await Offering.updateOne({ _id: offering._id }, { $inc: { enrolledCount: -1 } });
      throw err;
    }
  };

  for (const o of ordered) {
    if (o.status !== 'Open' || picked.some((p) => offeringsConflict(p, o))) continue;
    const placed = await attempt(o);
    if (placed) return placed;
  }
  // No section fits: open a new one for the student's section (S, S2, S3, ...).
  const taken = new Set(existing.map((o) => o.section));
  let section = student.section;
  for (let n = 2; taken.has(section) && n < 10; n += 1) section = `${student.section}${n}`;
  const created = await Offering.create({
    term: term._id,
    subject: subject._id,
    section,
    professor: PROFESSORS[Math.floor(makeRng(`prof|${subject.code}|${section}`)() * PROFESSORS.length)],
    capacity: 40,
    meetings: chooseMeetings(subject, student.studentId, picked),
  });
  return attempt(created);
}

async function loadStudent(studentId) {
  const student = await Student.findById(studentId);
  if (!student) throw new EnrollmentError('STUDENT_NOT_FOUND', 'Student not found', 404);
  if (student.academicStatus !== 'Enrolled') throw new EnrollmentError('STUDENT_NOT_ACTIVE', `A student whose status is ${student.academicStatus} cannot be given classes.`);
  if (!student.program && student.course) student.program = (await Course.findOne({ code: student.course }).select('_id'))?._id;
  if (!student.program) throw new EnrollmentError('NO_PROGRAM', 'This student has no course yet. Enroll them in a course first.', 409);
  if (!YEARS.includes(student.yearLevel) || !student.section) throw new EnrollmentError('NO_YEAR_LEVEL', 'This student needs a year level and a section first.', 409);
  await student.populate('program');
  return student;
}

/**
 * Give a student classes for the current term and (optionally) completed earlier semesters with grades.
 * Returns { currentClasses, termsCompleted, gradesPosted, skipped: [reason] }.
 */
async function generateSampleRecords(studentId, { history = false, actorId } = {}) {
  const student = await loadStudent(studentId);
  const current = await Term.findOne({ isCurrent: true });
  if (!current) throw new EnrollmentError('NO_TERM', 'There is no current term. Set one up first.', 409);

  const result = { currentClasses: 0, termsCompleted: 0, gradesPosted: 0, skipped: [] };
  const terms = await Term.find({ semester: { $in: SEMESTERS } }).sort({ startDate: 1 });
  const currentIndex = terms.findIndex((t) => String(t._id) === String(current._id));
  const completedBefore = YEARS.indexOf(student.yearLevel) * 2 + (current.semester === '2nd Semester' ? 1 : 0);

  if (history && currentIndex >= 0) {
    for (let j = 0; j < completedBefore; j += 1) {
      const term = terms[currentIndex - completedBefore + j];
      const label = `${YEARS[Math.floor(j / 2)]} ${SEMESTERS[j % 2]}`;
      if (!term) {
        result.skipped.push(`${label}: the calendar has no earlier term for it`);
        continue;
      }
      if (await Enrollment.exists({ student: student._id, term: term._id })) {
        result.skipped.push(`${term.name}: the student already has records there`);
        continue;
      }
      const subjects = await slotSubjects(student.program, YEARS[Math.floor(j / 2)], SEMESTERS[j % 2]);
      if (subjects.length === 0) {
        result.skipped.push(`${label}: the program has no subjects listed for it`);
        continue;
      }
      const picked = [];
      for (const subject of subjects) {
        const placed = await placeInSubject({ student, term, subject, status: 'Completed', picked });
        if (!placed) continue;
        picked.push(placed.offering);
        const value = GRADE_POOL[Math.floor(makeRng(`${student.studentId}|${subject.code}`)() ** 1.8 * GRADE_POOL.length)];
        await Grade.create({ student: student._id, enrollment: placed.enrollment._id, value, postedBy: actorId, postedAt: term.endDate });
        result.gradesPosted += 1;
      }
      result.termsCompleted += 1;
    }
  }

  const subjects = await slotSubjects(student.program, student.yearLevel, current.semester);
  if (subjects.length === 0) {
    result.skipped.push(`${current.name}: the program has no subjects listed for ${student.yearLevel}, ${current.semester}`);
  } else {
    const already = await Enrollment.find({ student: student._id, term: current._id, status: { $ne: 'Dropped' } }).populate('offering');
    const picked = already.map((e) => e.offering).filter(Boolean);
    const have = new Set(already.map((e) => String(e.subject)));
    for (const subject of subjects) {
      if (have.has(String(subject._id))) continue;
      const placed = await placeInSubject({ student, term: current, subject, status: 'Enrolled', picked });
      if (!placed) continue;
      picked.push(placed.offering);
      result.currentClasses += 1;
    }
  }

  if (result.termsCompleted > 0) await Student.updateOne({ _id: student._id }, { $set: { sampleRecordsAt: new Date() } });
  return result;
}

// Remove everything generated (and anything else in enrollments, grades and attendance) for a student
// whose record is marked as holding sample data.
async function clearSampleRecords(studentId) {
  const student = await Student.findById(studentId).select('sampleRecordsAt');
  if (!student) throw new EnrollmentError('STUDENT_NOT_FOUND', 'Student not found', 404);
  if (!student.sampleRecordsAt) throw new EnrollmentError('NO_SAMPLE_RECORDS', 'This student has no generated sample records to remove.', 409);
  const removed = await clearAcademicRecords(studentId);
  await Student.updateOne({ _id: studentId }, { $unset: { sampleRecordsAt: 1 } });
  return { removed };
}

// Enrolled students with a course, year and section but no enrollments at all.
async function studentsWithoutRecords() {
  const withRecords = await Enrollment.distinct('student');
  return Student.find({ academicStatus: 'Enrolled', course: { $ne: '' }, yearLevel: { $in: YEARS }, section: { $ne: '' }, _id: { $nin: withRecords } }).sort({ studentId: 1 });
}

module.exports = { generateSampleRecords, clearSampleRecords, studentsWithoutRecords };

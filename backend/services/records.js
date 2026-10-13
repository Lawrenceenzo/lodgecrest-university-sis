// Shared by the admin records routes and the student portal routes: loads a student's classes with
// their term, subject, section and grade, groups them by term and turns them into standings.
// Everything is scoped to the one student id it is given.
const { Enrollment, Grade } = require('../models');

const termJson = (t) => ({ id: String(t._id), name: t.name, academicYear: t.academicYear, semester: t.semester, startDate: t.startDate, endDate: t.endDate, isCurrent: t.isCurrent, enrollmentOpen: t.enrollmentOpen });
const meetingJson = (m) => ({ day: m.day, start: m.start, end: m.end, room: m.room });

// Every enrollment of a student with its term, subject, class and grade, as plain objects.
async function loadRows(studentId) {
  const [enrollments, grades] = await Promise.all([
    Enrollment.find({ student: studentId }).populate('term').populate('subject').populate('offering'),
    Grade.find({ student: studentId }),
  ]);
  const gradeByEnrollment = new Map(grades.map((g) => [String(g.enrollment), g]));
  return enrollments.map((e) => {
    const g = gradeByEnrollment.get(String(e._id));
    return {
      id: String(e._id),
      status: e.status,
      enrolledAt: e.enrolledAt,
      droppedAt: e.droppedAt,
      term: termJson(e.term),
      subject: { id: String(e.subject._id), code: e.subject.code, title: e.subject.title, units: e.subject.units, countsToGwa: e.subject.countsToGwa },
      offering: { id: String(e.offering._id), section: e.offering.section, professor: e.offering.professor, meetings: e.offering.meetings.map(meetingJson) },
      grade: g ? { id: String(g._id), value: g.value ?? null, mark: g.mark ?? null, remark: g.remark, postedAt: g.postedAt } : null,
    };
  });
}

// Group rows by term, newest term first.
function groupByTerm(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.term.id)) groups.set(r.term.id, { term: r.term, rows: [] });
    groups.get(r.term.id).rows.push(r);
  }
  return [...groups.values()]
    .sort((a, b) => new Date(b.term.startDate) - new Date(a.term.startDate))
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => a.subject.code.localeCompare(b.subject.code)) }));
}

// Rows -> the shape computeStanding() expects (only classes that have a grade).
const standingInput = (rows) =>
  rows.filter((r) => r.grade).map((r) => ({ subjectId: r.subject.id, units: r.subject.units, countsToGwa: r.subject.countsToGwa, value: r.grade.value, mark: r.grade.mark }));

// computeStanding() returns subject ids; the screens want codes and titles.
function describeStanding(standing, rows) {
  const subjects = new Map(rows.map((r) => [r.subject.id, r.subject]));
  const label = (id) => ({ id, code: subjects.get(id)?.code, title: subjects.get(id)?.title });
  return { ...standing, outstandingFailures: standing.outstandingFailures.map(label), incomplete: standing.incomplete.map(label) };
}

module.exports = { termJson, meetingJson, loadRows, groupByTerm, standingInput, describeStanding };

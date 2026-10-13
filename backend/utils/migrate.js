const models = require('../models');
const { BASE_COURSES } = require('../config/baseCatalog');

const { User, Student, Course, Term } = models;

// Runs at every start-up; safe to repeat. Brings older data in line with the current schema.
async function migrate() {
  // Before roles existed, admins were stored with the label "Administrator".
  const legacy = await User.updateMany({ role: 'Administrator' }, { $set: { role: 'admin' } });
  if (legacy.modifiedCount) console.log(`Migrated ${legacy.modifiedCount} legacy administrator account(s) to role "admin".`);

  // Students created before the lifecycle existed have no academicStatus: they are active.
  const noStatus = await Student.updateMany({ academicStatus: { $exists: false } }, { $set: { academicStatus: 'Enrolled' } });
  if (noStatus.modifiedCount) console.log(`Set academicStatus "Enrolled" on ${noStatus.modifiedCount} existing student(s).`);

  // Build the indexes of every model now, so the unique rules (one enrollment per student per subject
  // per term, one current term, ...) are in force before the first request is served.
  await Promise.all(Object.values(models).map((Model) => Model.init()));

  await ensureBaseCourses();
  await linkStudentsToPrograms();
  await ensureDefaultTerms();
}

// The programs the admin forms offer must exist as Course records.
async function ensureBaseCourses() {
  let created = 0;
  for (const course of BASE_COURSES) {
    const result = await Course.updateOne({ code: course.code }, { $setOnInsert: course }, { upsert: true });
    if (result.upsertedCount) created += 1;
  }
  if (created) console.log(`Created ${created} base course(s) in the catalog.`);
}

// Students store a short course code ("BSIT"). Give each one a real link to its Course record (by _id)
// so units, curriculum and requirements can be looked up. A code with no Course gets a placeholder.
async function linkStudentsToPrograms() {
  const codes = await Student.distinct('course', { course: { $nin: ['', null] }, program: { $exists: false } });
  let linked = 0;
  for (const code of codes) {
    let course = await Course.findOne({ code });
    if (!course) {
      course = await Course.create({ code, name: code, totalUnits: 150 }); // placeholder: rename and set units in the catalog
      console.log(`Created placeholder course "${code}" (found on existing students). Set its name and units in the catalog.`);
    }
    const result = await Student.updateMany({ course: code, program: { $exists: false } }, { $set: { program: course._id } });
    linked += result.modifiedCount;
  }
  if (linked) console.log(`Linked ${linked} existing student(s) to their course record.`);
}

// A fresh database has no calendar. Create the current and the next term so the system has something
// to work with (idempotent: only when there are no terms at all).
async function ensureDefaultTerms() {
  if ((await Term.estimatedDocumentCount()) > 0) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0 = January
  const utc = (year, month, day) => new Date(Date.UTC(year, month, day));
  const firstSem = (year) => ({ academicYear: `${year}-${year + 1}`, semester: '1st Semester', startDate: utc(year, 7, 10), endDate: utc(year, 11, 18) });
  const secondSem = (year) => ({ academicYear: `${year - 1}-${year}`, semester: '2nd Semester', startDate: utc(year, 0, 11), endDate: utc(year, 4, 28) });

  // Jan-May: 2nd semester of the year that began last August. Otherwise: the 1st semester starting this August.
  const inSecond = m <= 4;
  const current = inSecond ? secondSem(y) : firstSem(y);
  const next = inSecond ? firstSem(y) : secondSem(y + 1);
  await Term.create([{ ...current, isCurrent: true }, { ...next, enrollmentOpen: true }]);
  console.log(`Created default terms: ${current.academicYear} ${current.semester} (current) and ${next.academicYear} ${next.semester}.`);
}

module.exports = { migrate };

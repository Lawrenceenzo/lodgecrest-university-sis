// Tests that the admin catalog is really stored in MongoDB: courses, subjects, teachers and sections,
// plus the students/enrollment round trip. Every check reads back through a NEW request (and, where it
// matters, straight from the collection), so a record that only existed in memory would fail here.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27017/lodgecrest_test" npm test
//
// Like the other database tests, these ERASE the database they connect to (its name must contain "test").

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';

const URI = process.env.MONGO_TEST_URI;
const skip = URI ? false : 'set MONGO_TEST_URI to run the database tests';

const models = require('../models');
const { Student, User, Course, Subject, Teacher, Section } = models;
const { runSeed } = require('../seed/index');
const app = require('../app');

async function resetDatabase() {
  const name = mongoose.connection.name;
  if (!/test/i.test(name)) throw new Error(`Refusing to erase database "${name}": its name must contain "test".`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((M) => M.syncIndexes()));
}

describe('catalog persistence', { skip }, () => {
  let server;
  let origin;
  let adminToken;
  let studentToken;

  const sign = (user) => jwt.sign({ id: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function call(method, path, body, token = adminToken) {
    const res = await fetch(`${origin}/api${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  before(async () => {
    await mongoose.connect(URI);
    await resetDatabase();
    await runSeed({ log: () => {} });
    adminToken = sign(await User.findOne({ role: 'admin' }));
    studentToken = sign(await User.findOne({ role: 'student' }));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  test('administrators only', async () => {
    const id = new mongoose.Types.ObjectId();
    for (const resource of ['courses', 'subjects', 'teachers', 'sections']) {
      for (const [method, path] of [['GET', `/${resource}`], ['POST', `/${resource}`], ['PUT', `/${resource}/${id}`], ['DELETE', `/${resource}/${id}`]]) {
        const body = method === 'GET' || method === 'DELETE' ? undefined : {};
        assert.equal((await call(method, path, body, null)).status, 401, `${method} ${path} without a token`);
        assert.equal((await call(method, path, body, studentToken)).status, 403, `${method} ${path} as a student`);
      }
    }
  });

  test('the seed already provides courses, subjects, teachers and sections', async () => {
    const courses = (await call('GET', '/courses')).json;
    assert.deepEqual(courses.map((c) => c.code), ['BSA', 'BSBA', 'BSCS', 'BSCpE', 'BSIT', 'BSPsy'].sort());
    assert.ok(courses.find((c) => c.code === 'BSIT').students >= 2, 'student counts come from the students collection');
    assert.ok((await call('GET', '/subjects')).json.length >= 50);
    assert.equal((await call('GET', '/teachers')).json.length, 8);
    const sections = (await call('GET', '/sections')).json;
    assert.ok(sections.length >= 4);
    assert.ok(sections.every((s) => s.adviser && /^[A-Za-z]+-\d[A-C]$/.test(s.name)));
  });

  test('courses: added, stored, listed again, edited, protected and deleted', async () => {
    const made = await call('POST', '/courses', { code: 'BSEd', name: 'BS Education', department: 'College of Arts and Sciences', years: '4', totalUnits: '140' });
    assert.equal(made.status, 201);
    assert.deepEqual([made.json.code, made.json.years, made.json.totalUnits, made.json.students], ['BSEd', 4, 140, 0]);

    // It is in the database itself, and a brand-new request sees it.
    assert.equal((await Course.findOne({ code: 'BSEd' })).name, 'BS Education');
    assert.ok((await call('GET', '/courses')).json.some((c) => c.code === 'BSEd'));

    assert.equal((await call('POST', '/courses', { code: 'bsed', name: 'Duplicate', totalUnits: 1 })).status, 409, 'codes are unique regardless of case');
    for (const bad of [{}, { code: 'X', name: 'Too short a code', totalUnits: 100 }, { code: 'OK1', name: 'No units' }, { code: 'OK2', name: 'Bad years', years: 99, totalUnits: 100 }, { code: 'OK3', name: 'Bad units', totalUnits: 'many' }]) {
      assert.equal((await call('POST', '/courses', bad)).status, 400, JSON.stringify(bad));
    }

    const edited = await call('PUT', `/courses/${made.json.id}`, { name: 'BS Secondary Education', totalUnits: 145 });
    assert.equal(edited.json.name, 'BS Secondary Education');
    assert.equal((await Course.findById(made.json.id)).totalUnits, 145);
    assert.equal((await call('PUT', `/courses/${made.json.id}`, { code: 'NEWCODE' })).status, 400, 'the code is fixed');

    const bsit = (await call('GET', '/courses')).json.find((c) => c.code === 'BSIT');
    const blocked = await call('DELETE', `/courses/${bsit.id}`);
    assert.equal(blocked.status, 409);
    assert.match(blocked.json.message, /student/);
    assert.equal((await call('DELETE', `/courses/${made.json.id}`)).status, 200);
    assert.equal(await Course.countDocuments({ code: 'BSEd' }), 0);
    assert.equal((await call('DELETE', `/courses/${made.json.id}`)).status, 404);
  });

  test('subjects: placed in a course, year and semester, with prerequisites, and stored', async () => {
    const made = await call('POST', '/subjects', { code: 'IT450', title: 'Cloud Security', units: '3', course: 'BSIT', yearLevel: '4th Year', semester: '2nd Semester', prerequisites: 'IT306, it309' });
    assert.equal(made.status, 201);
    assert.deepEqual(made.json.prerequisites.sort(), ['IT306', 'IT309']);
    assert.deepEqual(made.json.curriculum, [{ course: 'BSIT', yearLevel: '4th Year', semester: '2nd Semester' }]);
    const stored = await Subject.findOne({ code: 'IT450' }).populate('prerequisites', 'code');
    assert.equal(stored.units, 3);
    assert.equal(stored.prerequisites.length, 2);
    assert.ok((await call('GET', '/subjects')).json.some((s) => s.code === 'IT450'));

    const all = await call('POST', '/subjects', { code: 'GE200', title: 'Civic Studies', units: 3, course: 'All Courses', yearLevel: '1st Year', semester: '1st Semester' });
    assert.equal(all.json.curriculum.length, await Course.countDocuments(), 'placed in every program');

    assert.equal((await call('POST', '/subjects', { code: 'it450', title: 'Dupe', units: 3, course: 'BSIT', yearLevel: '1st Year', semester: '1st Semester' })).status, 409);
    for (const bad of [{}, { code: 'ZZ1', title: 'x', units: 3, course: 'NOPE', yearLevel: '1st Year', semester: '1st Semester' }, { code: 'ZZ2', title: 'x', units: 3, course: 'BSIT', yearLevel: '9th Year', semester: '1st Semester' }, { code: 'ZZ3', title: 'x', units: 3, course: 'BSIT', yearLevel: '1st Year', semester: '1st Semester', prerequisites: 'MISSING1' }, { code: 'ZZ4', title: 'x', units: 99, course: 'BSIT', yearLevel: '1st Year', semester: '1st Semester' }]) {
      const r = await call('POST', '/subjects', bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
    }

    const edited = await call('PUT', `/subjects/${made.json.id}`, { title: 'Cloud and Network Security', units: 4, prerequisites: ['IT306'] });
    assert.deepEqual([edited.json.title, edited.json.units, edited.json.prerequisites], ['Cloud and Network Security', 4, ['IT306']]);
    assert.equal((await Subject.findById(made.json.id)).units, 4);
    assert.equal((await call('PUT', `/subjects/${made.json.id}`, { prerequisites: 'IT450' })).status, 400, 'not its own prerequisite');

    const it306 = (await call('GET', '/subjects')).json.find((s) => s.code === 'IT306');
    assert.equal((await call('DELETE', `/subjects/${it306.id}`)).status, 409, 'still required by IT450');
    assert.equal((await call('DELETE', `/subjects/${made.json.id}`)).status, 200);
    assert.equal(await Subject.countDocuments({ code: 'IT450' }), 0);
  });

  test('teachers: an employee id is assigned, the e-mail is unique, and an adviser cannot be removed', async () => {
    const made = await call('POST', '/teachers', { name: "Dr. Ana O'Neil", department: 'College of Computing', email: 'Ana.ONeil@Lodgecrest.edu' });
    assert.equal(made.status, 201);
    assert.equal(made.json.employeeId, 'EMP-0009', 'one past the eight seeded teachers');
    assert.equal(made.json.email, 'ana.oneil@lodgecrest.edu', 'stored in lower case');
    assert.equal((await Teacher.findOne({ employeeId: 'EMP-0009' })).name, "Dr. Ana O'Neil");
    assert.ok((await call('GET', '/teachers')).json.some((t) => t.email === 'ana.oneil@lodgecrest.edu'));

    assert.equal((await call('POST', '/teachers', { name: 'Someone Else', department: 'X', email: 'ana.oneil@lodgecrest.edu' })).status, 409);
    for (const bad of [{}, { name: 'A', department: 'D', email: 'a@b.co' }, { name: '1234', department: 'D', email: 'ok@b.co' }, { name: 'Valid Name', department: 'D', email: 'not-an-email' }, { name: 'Valid Name', email: 'ok2@b.co' }]) {
      assert.equal((await call('POST', '/teachers', bad)).status, 400, JSON.stringify(bad));
    }
    const second = await call('POST', '/teachers', { name: 'Second Teacher', department: 'College of Business', email: 'second@lodgecrest.edu' });
    assert.equal(second.json.employeeId, 'EMP-0010');

    const edited = await call('PUT', `/teachers/${made.json.id}`, { department: 'College of Business', contactNumber: '0917 000 1111' });
    assert.deepEqual([edited.json.department, edited.json.contactNumber], ['College of Business', '0917 000 1111']);
    assert.equal((await call('PUT', `/teachers/${made.json.id}`, { employeeId: 'EMP-9999' })).status, 400);

    // She advises a section now, so she cannot be deleted or made inactive.
    const bsit = await Course.findOne({ code: 'BSIT' });
    const sec = await call('POST', '/sections', { course: 'BSIT', yearLevel: '4th Year', section: 'C', adviserId: made.json.id });
    assert.equal(sec.status, 201);
    assert.equal((await call('DELETE', `/teachers/${made.json.id}`)).status, 409);
    assert.equal((await call('PUT', `/teachers/${made.json.id}`, { status: 'Inactive' })).status, 409);
    assert.ok(bsit);
    assert.equal((await call('DELETE', `/sections/${sec.json.id}`)).status, 200);
    assert.equal((await call('DELETE', `/teachers/${made.json.id}`)).status, 200);
    assert.equal(await Teacher.countDocuments({ employeeId: 'EMP-0009' }), 0);
  });

  test('sections: stored with their adviser, unique per program/year/letter, counted from real students', async () => {
    const teacher = (await call('GET', '/teachers')).json[0];
    const made = await call('POST', '/sections', { course: 'BSBA', yearLevel: '2nd Year', section: 'B', adviserId: teacher.id, capacity: '35' });
    assert.equal(made.status, 201);
    assert.deepEqual([made.json.name, made.json.adviser, made.json.capacity, made.json.students], ['BSBA-2B', teacher.name, 35, 0]);
    const stored = await Section.findById(made.json.id);
    assert.equal(String(stored.adviser), teacher.id);
    assert.ok((await call('GET', '/sections')).json.some((s) => s.name === 'BSBA-2B'));

    assert.equal((await call('POST', '/sections', { course: 'BSBA', yearLevel: '2nd Year', section: 'B', adviserId: teacher.id })).status, 409, 'one BSBA-2B only');
    for (const bad of [{}, { course: 'NOPE', yearLevel: '2nd Year', section: 'A', adviserId: teacher.id }, { course: 'BSBA', yearLevel: '2nd Year', section: 'Z', adviserId: teacher.id }, { course: 'BSBA', yearLevel: '2nd Year', section: 'A', adviserId: 'not-an-id' }, { course: 'BSBA', yearLevel: '2nd Year', section: 'A', adviserId: teacher.id, capacity: 500 }]) {
      assert.equal((await call('POST', '/sections', bad)).status, 400, JSON.stringify(bad));
    }

    // A section's student count follows the students collection.
    const reyes = await Student.findOne({ studentId: '2026-0002' });
    const seeded = (await call('GET', '/sections')).json.find((s) => s.course === reyes.course && s.yearLevel === reyes.yearLevel && s.section === reyes.section);
    assert.ok(seeded.students >= 1);
    assert.equal((await call('DELETE', `/sections/${seeded.id}`)).status, 409, 'a section with students stays');

    const other = (await call('GET', '/teachers')).json[1];
    assert.equal((await call('PUT', `/sections/${made.json.id}`, { adviserId: other.id, capacity: 30 })).json.adviser, other.name);
    assert.equal((await Section.findById(made.json.id)).capacity, 30);
    await Teacher.updateOne({ _id: teacher.id }, { status: 'Inactive' });
    assert.equal((await call('PUT', `/sections/${made.json.id}`, { adviserId: teacher.id })).status, 400, 'an inactive teacher cannot advise');
    await Teacher.updateOne({ _id: teacher.id }, { status: 'Active' });
    assert.equal((await call('DELETE', `/sections/${made.json.id}`)).status, 200);
  });

  test('students and enrollments: a new student is stored, listed afresh, enrolled, and still there', async () => {
    const created = await call('POST', '/students', { firstName: 'Nina', lastName: 'Persist', dob: '2005-03-04', gender: 'Female', email: 'nina.persist@example.test', contactNumber: '09171234567', address: 'Imus, Cavite', nationality: 'Filipino' });
    assert.equal(created.status, 201);
    assert.equal(created.json.status, 'Pending');
    const id = created.json.id;
    assert.equal((await Student.findById(id)).email, 'nina.persist@example.test', 'written to MongoDB');
    assert.ok((await call('GET', '/students')).json.some((s) => s.id === id), 'a fresh list request returns it');
    assert.equal((await call('GET', `/students/${id}`)).json.firstName, 'Nina');
    assert.ok((await call('GET', '/students?status=Pending')).json.some((s) => s.id === id));

    // The "New Enrollment" step: it moves the student from Pending to Enrolled for good.
    const enrolled = await call('PUT', `/students/${id}`, { status: 'Enrolled', course: 'BSIT', yearLevel: '1st Year', section: 'A' });
    assert.equal(enrolled.status, 200);
    const stored = await Student.findById(id);
    assert.deepEqual([stored.status, stored.course, stored.yearLevel, stored.section], ['Enrolled', 'BSIT', '1st Year', 'A']);
    assert.ok(stored.program, 'linked to the BSIT course record');
    assert.ok((await call('GET', '/students?status=Enrolled&course=BSIT')).json.some((s) => s.id === id), 'the Enrollment list shows it');
    assert.ok(!(await call('GET', '/students?status=Pending')).json.some((s) => s.id === id));

    // A newly added course can be given to a student at once (nothing is hard-coded).
    const course = await call('POST', '/courses', { code: 'BSEd', name: 'BS Education', department: 'College of Arts and Sciences', totalUnits: 140 });
    assert.equal(course.status, 201);
    const moved = await call('PUT', `/students/${id}`, { course: 'BSEd' });
    assert.equal(moved.status, 200);
    assert.equal(String((await Student.findById(id)).program), course.json.id);
  });
});

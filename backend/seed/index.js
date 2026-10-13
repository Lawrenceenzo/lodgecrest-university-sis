// Builds the whole sample database: students and logins, programs, calendar, curriculum, class
// offerings, enrollments with grades, attendance, statements of account and holds.
// Everything is deterministic (same data every run) except attendance, which runs up to today.
//
// WARNING: runSeed() DELETES all existing data in these collections first.

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const models = require('../models');
const seedStudents = require('../data/seedStudents');
const brand = require('../config/brand');
const { BASE_COURSES, EXTRA_COURSES } = require('../config/baseCatalog');
const { UPLOAD_DIR } = require('../middleware/upload');
const { SUBJECTS, SLOTS } = require('./curriculum');
const { makeRng, PROFESSORS, TIME_SLOTS } = require('../config/timetable');

const { Student, User, Course, Term, Subject, Offering, Enrollment, Grade, Attendance, Charge, Payment, Hold, PreEnrollment, Teacher, Section } = models;

// ----------------------------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------------------------

const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const isoDay = (date) => date.toISOString().slice(0, 10);
const addDays = (date, n) => new Date(date.getTime() + n * 86400000);
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const GRADE_POOL = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75];
const TUITION_PER_UNIT = 1350;
const MISC_FEE = 4500;
const LAB_FEE = 2500;
const PAY_METHODS = ['Bank Transfer', 'GCash', 'Cash', 'Bank Transfer'];

// How far each sample student has got. `start` is the year they began (1st semester = their
// first term), `completed` the number of finished semesters, `current` whether they are enrolled now.
const COHORTS = {
  '2026-0001': { start: 2025, completed: 2, current: true }, // Santos, BSIT 2nd year
  '2026-0002': { start: 2026, completed: 0, current: true }, // Reyes, BSCS 1st year
  '2026-0003': { start: 2024, completed: 4, current: true }, // Cruz, BSA 3rd year
  '2026-0004': { start: 2026, completed: 0, current: true }, // Dela Cruz, BSIT 1st year
  '2026-0005': { start: 2022, completed: 8, current: false }, // Garcia, BSIT graduate (all 8 semesters)
  '2026-0007': { start: 2024, completed: 4, current: false }, // Villanueva, BSA, transferred out
};

// ----------------------------------------------------------------------------------------------

async function clearEverything() {
  await Promise.all(Object.values(models).map((Model) => Model.deleteMany({})));
  // Photos belonged to the students just deleted, so remove them too (keeps .gitkeep).
  for (const file of fs.readdirSync(UPLOAD_DIR)) {
    if (file !== '.gitkeep') fs.unlinkSync(path.join(UPLOAD_DIR, file));
  }
  await Promise.all(Object.values(models).map((Model) => Model.syncIndexes()));
}

async function runSeed({ log = console.log } = {}) {
  await clearEverything();

  // ---- Programs ----------------------------------------------------------------------------
  const courseDocs = await Course.insertMany([...BASE_COURSES, ...EXTRA_COURSES]);
  const courseByCode = Object.fromEntries(courseDocs.map((c) => [c.code, c]));

  // ---- Calendar: 2022-2023 1st semester ... 2026-2027 2nd semester (index 0-9) ----------------
  const termInputs = [];
  for (let y = 2022; y <= 2026; y += 1) {
    termInputs.push({ academicYear: `${y}-${y + 1}`, semester: '1st Semester', startDate: utc(y, 7, 10), endDate: utc(y, 11, 18) });
    termInputs.push({ academicYear: `${y}-${y + 1}`, semester: '2nd Semester', startDate: utc(y + 1, 0, 11), endDate: utc(y + 1, 4, 28) });
  }
  const CURRENT = 8; // 2026-2027 1st Semester
  const NEXT = 9; // 2026-2027 2nd Semester, open for pre-enrollment
  termInputs[CURRENT].isCurrent = true;
  termInputs[NEXT].enrollmentOpen = true;
  const terms = await Term.insertMany(termInputs);

  // ---- Subjects (prerequisites and curriculum placements resolved to _id links) --------------
  const subjectInputs = Object.entries(SUBJECTS).map(([code, [title, units, opts = {}]]) => ({
    code, title, units, countsToGwa: opts.gwa !== false, prerequisites: [], curriculum: [],
  }));
  const subjectDocs = await Subject.insertMany(subjectInputs);
  const subjectByCode = Object.fromEntries(subjectDocs.map((s) => [s.code, s]));

  const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const SEMS = ['1st Semester', '2nd Semester'];
  const updates = new Map(subjectDocs.map((s) => [s.code, { $set: { prerequisites: [] }, $push: { curriculum: { $each: [] } } }]));
  for (const [code, [, , opts = {}]] of Object.entries(SUBJECTS)) {
    updates.get(code).$set.prerequisites = (opts.prereqs || []).map((p) => subjectByCode[p]._id);
  }
  for (const [courseCode, year, sem, codes] of SLOTS) {
    for (const code of codes) {
      updates.get(code).$push.curriculum.$each.push({ course: courseByCode[courseCode]._id, yearLevel: YEARS[year - 1], semester: SEMS[sem - 1] });
    }
  }
  await Subject.bulkWrite([...updates].map(([code, update]) => ({ updateOne: { filter: { _id: subjectByCode[code]._id }, update } })));

  // ---- Users and students -------------------------------------------------------------------
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || process.env.EMAIL_USER || `admin@${brand.domain}`).toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const admin = await User.create({ name: 'Admin', email: adminEmail, password: await bcrypt.hash(adminPassword, 10), role: 'admin' });

  // Validate every student, then insert directly so the sample createdAt dates are kept.
  const studentDocs = [];
  for (const raw of seedStudents) {
    const created = new Date(raw.createdAt);
    const lifecycle = raw.academicStatus === 'Archived' ? { statusBeforeArchive: 'Enrolled', archivedAt: created } : {};
    const program = raw.course ? courseByCode[raw.course]._id : undefined;
    const doc = new Student({ ...raw, ...lifecycle, program, createdAt: created, updatedAt: created });
    await doc.validate();
    studentDocs.push(doc.toObject());
  }
  await Student.collection.insertMany(studentDocs);
  const studentByNumber = Object.fromEntries(studentDocs.map((s) => [s.studentId, s]));

  // ---- Faculty and class sections (every section the sample students sit in has an adviser) -------
  const DEPARTMENTS = ['College of Computing', 'College of Computing', 'College of Business', 'College of Computing', 'College of Engineering', 'College of Business', 'College of Arts and Sciences', 'College of Computing'];
  const teacherDocs = await Teacher.insertMany(
    PROFESSORS.map((full, i) => {
      const name = full.replace(/^Prof\.\s*/, '');
      return { employeeId: `EMP-${String(i + 1).padStart(4, '0')}`, name, department: DEPARTMENTS[i % DEPARTMENTS.length], email: `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, '.')}@${brand.domain}` };
    }),
  );
  const sectionKeys = [...new Set(seedStudents.filter((s) => s.course && s.yearLevel && s.section).map((s) => `${s.course}|${s.yearLevel}|${s.section}`))].sort();
  await Section.insertMany(
    sectionKeys.map((key, i) => {
      const [course, yearLevel, name] = key.split('|');
      return { course: courseByCode[course]._id, yearLevel, name, adviser: teacherDocs[i % teacherDocs.length]._id };
    }),
  );

  const maria = studentByNumber['2026-0001'];
  const studentEmail = (process.env.SEED_STUDENT_EMAIL || maria.email).toLowerCase();
  if (studentEmail === adminEmail) throw new Error('SEED_STUDENT_EMAIL must differ from the admin e-mail');
  await User.create({
    name: `${maria.firstName} ${maria.lastName}`,
    email: studentEmail,
    password: await bcrypt.hash(process.env.SEED_STUDENT_PASSWORD || 'student123', 10),
    role: 'student',
    student: maria._id,
  });

  // ---- Offerings: created on demand, one per (term, subject, section) ------------------------
  const offeringByKey = new Map();
  const slotCounter = new Map(); // (term, section) -> how many time slots are used
  const offeringInputs = [];
  const getOffering = (termIdx, code, section) => {
    const key = `${termIdx}|${code}|${section}`;
    if (offeringByKey.has(key)) return offeringByKey.get(key);

    let meetings;
    const n = slotCounter.get(`${termIdx}|${section}`) || 0;
    if (code.startsWith('NSTP')) {
      meetings = [{ day: 'Sat', start: '08:00', end: '11:00', room: 'Gym Annex' }]; // weekend program, takes no weekday slot
    } else {
      const slot = TIME_SLOTS[n % TIME_SLOTS.length];
      slotCounter.set(`${termIdx}|${section}`, n + 1);
      meetings = slot.days.map((day) => ({ day, start: slot.time[0], end: slot.time[1], room: `Rm ${200 + ((n * 7 + code.length * 3) % 40)}` }));
    }
    const input = {
      term: terms[termIdx]._id,
      subject: subjectByCode[code]._id,
      section,
      professor: PROFESSORS[(code.charCodeAt(code.length - 1) + n) % PROFESSORS.length],
      capacity: 40,
      meetings,
    };
    offeringInputs.push(input);
    offeringByKey.set(key, input);
    return input;
  };

  // For each student, work out the (term, subject, section) they take, semester by semester.
  const plan = []; // { student, termIdx, code, section, state: 'completed' | 'current', k }
  const nextPlan = []; // { student, codes }: what each current student will take next semester
  for (const [number, cohort] of Object.entries(COHORTS)) {
    const student = studentByNumber[number];
    const slotsOfProgram = SLOTS.filter(([c]) => c === student.course);
    const total = cohort.completed + (cohort.current ? 1 : 0);
    for (let k = 0; k < total; k += 1) {
      const slot = slotsOfProgram.find(([, year, sem]) => year === Math.floor(k / 2) + 1 && sem === (k % 2) + 1);
      const termIdx = (cohort.start - 2022) * 2 + k;
      for (const code of slot[3]) {
        getOffering(termIdx, code, student.section);
        plan.push({ student, termIdx, code, section: student.section, state: k < cohort.completed ? 'completed' : 'current', k });
      }
    }
    // Next semester's classes exist as offerings (students pre-enroll in them later). BSIT also gets a
    // second section, so the picker has a choice to make.
    if (cohort.current) {
      const k = total;
      const slot = slotsOfProgram.find(([, year, sem]) => year === Math.floor(k / 2) + 1 && sem === (k % 2) + 1);
      if (slot) {
        for (const code of slot[3]) getOffering(NEXT, code, student.section);
        if (student.course === 'BSIT') for (const code of slot[3]) getOffering(NEXT, code, student.section === 'B' ? 'C' : 'B');
        nextPlan.push({ student, codes: slot[3] });
      }
    }
  }
  const offeringDocs = await Offering.insertMany(offeringInputs);
  const offeringIdByKey = new Map([...offeringByKey].map(([key, input]) => [key, offeringDocs[offeringInputs.indexOf(input)]._id]));

  // ---- Enrollments -------------------------------------------------------------------------------
  const enrollmentInputs = plan.map((p) => ({
    student: p.student._id,
    offering: offeringIdByKey.get(`${p.termIdx}|${p.code}|${p.section}`),
    status: p.state === 'completed' ? 'Completed' : 'Enrolled',
    enrolledAt: addDays(terms[p.termIdx].startDate, -7),
  }));
  const enrollmentDocs = await Enrollment.insertMany(enrollmentInputs);

  // Seats taken = enrollments that are not Dropped.
  const seatCounts = new Map();
  for (const e of enrollmentDocs) seatCounts.set(String(e.offering), (seatCounts.get(String(e.offering)) || 0) + 1);
  await Offering.bulkWrite([...seatCounts].map(([id, n]) => ({ updateOne: { filter: { _id: id }, update: { $set: { enrolledCount: n } } } })));

  // ---- Grades for every finished enrollment ----------------------------------------------------------
  const gradeInputs = [];
  plan.forEach((p, i) => {
    if (p.state !== 'completed') return;
    const rand = makeRng(`${p.student.studentId}|${p.code}`);
    const skewed = Math.floor(rand() ** 1.8 * GRADE_POOL.length);
    const input = { student: p.student._id, enrollment: enrollmentDocs[i]._id, value: GRADE_POOL[skewed], postedBy: admin._id, postedAt: terms[p.termIdx].endDate };
    // Two memorable exceptions: an incomplete for Santos, a failed subject for Cruz.
    if (p.student.studentId === '2026-0001' && p.code === 'IT104') Object.assign(input, { value: undefined, mark: 'INC' });
    if (p.student.studentId === '2026-0003' && p.code === 'BUS102') input.value = 5;
    gradeInputs.push(input);
  });
  await Grade.insertMany(gradeInputs);

  // ---- Attendance for the current term, up to today ------------------------------------------------
  const currentTerm = terms[CURRENT];
  const lastDay = new Date(Math.min(Date.now(), currentTerm.endDate.getTime()));
  const attendanceInputs = [];
  plan.forEach((p, i) => {
    if (p.state !== 'current') return;
    const offering = offeringByKey.get(`${p.termIdx}|${p.code}|${p.section}`);
    const meetingDays = new Set(offering.meetings.map((m) => m.day));
    const rand = makeRng(`att|${p.student.studentId}|${p.code}`);
    for (let d = new Date(currentTerm.startDate); d <= lastDay; d = addDays(d, 1)) {
      if (!meetingDays.has(DAY_NAMES[d.getUTCDay()])) continue;
      const r = rand();
      attendanceInputs.push({
        student: p.student._id,
        offering: enrollmentDocs[i].offering,
        date: isoDay(d),
        status: r < 0.86 ? 'Present' : r < 0.92 ? 'Late' : r < 0.97 ? 'Absent' : 'Excused',
        recordedBy: admin._id,
      });
    }
  });
  if (attendanceInputs.length) await Attendance.insertMany(attendanceInputs);

  // ---- Statements of account ---------------------------------------------------------------------------
  const unitsByStudentTerm = new Map(); // "studentNumber|termIdx" -> { units, hasLab }
  plan.forEach((p) => {
    const key = `${p.student.studentId}|${p.termIdx}`;
    const row = unitsByStudentTerm.get(key) || { units: 0, hasLab: false };
    row.units += SUBJECTS[p.code][1];
    if (/^(IT|CS)\d/.test(p.code)) row.hasLab = true;
    unitsByStudentTerm.set(key, row);
  });

  const chargeInputs = [];
  const paymentInputs = [];
  let receipt = 1000;
  for (const [key, { units, hasLab }] of unitsByStudentTerm) {
    const [number, idxText] = key.split('|');
    const termIdx = Number(idxText);
    const student = studentByNumber[number];
    const term = terms[termIdx];
    const lines = [
      { category: 'Tuition', description: `Tuition (${units} units x PHP ${TUITION_PER_UNIT.toLocaleString('en-US')})`, amount: units * TUITION_PER_UNIT },
      { category: 'Miscellaneous', description: 'Miscellaneous fees', amount: MISC_FEE },
      ...(hasLab ? [{ category: 'Laboratory', description: 'Computer laboratory fee', amount: LAB_FEE }] : []),
    ];
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    for (const line of lines) chargeInputs.push({ student: student._id, term: term._id, dueDate: addDays(term.startDate, 30), ...line });

    // Past semesters were paid in full. For the current one, each student is in a different situation.
    const payAt = (days) => addDays(term.startDate, days);
    const pay = (amount, days, i = 0) => {
      receipt += 1;
      paymentInputs.push({ student: student._id, term: term._id, amount, method: PAY_METHODS[i % PAY_METHODS.length], receiptNo: `OR-${receipt}`, paidAt: payAt(days), recordedBy: admin._id });
    };
    if (termIdx !== CURRENT) pay(total, 12);
    else if (number === '2026-0001') { pay(10000, 5); pay(8000, 40, 1); } // Santos: part-paid
    else if (number === '2026-0002') pay(total, 3); // Reyes: paid in full
    else if (number === '2026-0003') pay(5000, 8); // Cruz: mostly unpaid
    else pay(Math.round(total / 2), 6); // Dela Cruz: half paid
  }
  await Charge.insertMany(chargeInputs);
  await Payment.insertMany(paymentInputs);

  // ---- Pre-enrollment: two requests waiting in the admin queue (Reyes and Dela Cruz) ---------------------
  const requestInputs = ['2026-0002', '2026-0004'].map((number, i) => {
    const { student, codes } = nextPlan.find((p) => p.student.studentId === number);
    const items = codes.map((code) => ({
      offering: offeringIdByKey.get(`${NEXT}|${code}|${student.section}`),
      subject: subjectByCode[code]._id,
      units: SUBJECTS[code][1],
    }));
    return { student: student._id, term: terms[NEXT]._id, items, totalUnits: items.reduce((n, x) => n + x.units, 0), submittedAt: new Date(Date.now() - (i + 1) * 36 * 3600 * 1000) };
  });
  await PreEnrollment.insertMany(requestInputs);

  // ---- Holds ----------------------------------------------------------------------------------------------
  await Hold.insertMany([
    { student: studentByNumber['2026-0001']._id, type: 'Library', reason: 'Unreturned book: "Introduction to Algorithms" (due Sep 15)', placedBy: admin._id, placedAt: utc(2026, 8, 20) },
    { student: studentByNumber['2026-0003']._id, type: 'Accounting', reason: 'Outstanding tuition balance past the due date', placedBy: admin._id, placedAt: utc(2026, 8, 12) },
    { student: studentByNumber['2026-0003']._id, type: 'Registrar', reason: 'Missing Form 137 (submitted and verified)', status: 'Cleared', placedBy: admin._id, clearedBy: admin._id, placedAt: utc(2024, 7, 20), clearedAt: utc(2024, 7, 28) },
  ]);

  const summary = {
    students: studentDocs.length,
    courses: courseDocs.length,
    terms: terms.length,
    subjects: subjectDocs.length,
    offerings: offeringDocs.length,
    enrollments: enrollmentDocs.length,
    grades: gradeInputs.length,
    attendance: attendanceInputs.length,
    charges: chargeInputs.length,
    payments: paymentInputs.length,
    holds: 3,
    teachers: teacherDocs.length,
    sections: sectionKeys.length,
    'pre-enrollment requests': requestInputs.length,
  };
  log(`Seeded: ${Object.entries(summary).map(([k, v]) => `${v} ${k}`).join(', ')}.`);
  log(`Admin sign-in:   ${adminEmail} (${process.env.SEED_ADMIN_PASSWORD ? 'password from SEED_ADMIN_PASSWORD' : 'password: admin123'})`);
  log(`Student sign-in: ${studentEmail} (${process.env.SEED_STUDENT_PASSWORD ? 'password from SEED_STUDENT_PASSWORD' : 'password: student123'})`);
  if (adminEmail === `admin@${brand.domain}`) log('Note: that admin e-mail is not a real inbox. Set SEED_ADMIN_EMAIL to your own address to receive codes.');
  return { summary, adminEmail, studentEmail };
}

module.exports = { runSeed, COHORTS, CURRENT_TERM_INDEX: 8 };

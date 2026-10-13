const Offering = require('../models/Offering');
const Enrollment = require('../models/Enrollment');
const Grade = require('../models/Grade');
const Attendance = require('../models/Attendance');
const Charge = require('../models/Charge');
const Payment = require('../models/Payment');
const Hold = require('../models/Hold');
const PreEnrollment = require('../models/PreEnrollment');

// Removes every academic record that belongs to a student (used when they are permanently deleted),
// and gives their seats back to the classes they were in.
async function purgeStudentRecords(studentId) {
  const seats = await Enrollment.find({ student: studentId, status: { $ne: 'Dropped' } }).select('offering');
  const perOffering = new Map();
  for (const e of seats) perOffering.set(String(e.offering), (perOffering.get(String(e.offering)) || 0) + 1);

  if (perOffering.size) {
    await Offering.bulkWrite([...perOffering].map(([id, n]) => ({ updateOne: { filter: { _id: id }, update: { $inc: { enrolledCount: -n } } } })));
  }
  const results = await Promise.all(
    [Grade, Attendance, Charge, Payment, Hold, PreEnrollment, Enrollment].map((Model) => Model.deleteMany({ student: studentId })),
  );
  return results.reduce((total, r) => total + r.deletedCount, 0);
}

module.exports = { purgeStudentRecords };

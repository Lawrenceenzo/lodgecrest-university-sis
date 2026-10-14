const Offering = require('../models/Offering');
const Enrollment = require('../models/Enrollment');
const Grade = require('../models/Grade');
const Attendance = require('../models/Attendance');
const Charge = require('../models/Charge');
const Payment = require('../models/Payment');
const Hold = require('../models/Hold');
const PreEnrollment = require('../models/PreEnrollment');
const PaymentSubmission = require('../models/PaymentSubmission');
const { removeProof } = require('../middleware/uploadProof');

// Removes a student's enrollments, grades and attendance, and gives their seats back to the classes
// they were in. (Charges, payments and holds are left alone.) Returns how many records were removed.
async function clearAcademicRecords(studentId) {
  const seats = await Enrollment.find({ student: studentId, status: { $ne: 'Dropped' } }).select('offering');
  const perOffering = new Map();
  for (const e of seats) perOffering.set(String(e.offering), (perOffering.get(String(e.offering)) || 0) + 1);

  if (perOffering.size) {
    await Offering.bulkWrite([...perOffering].map(([id, n]) => ({ updateOne: { filter: { _id: id }, update: { $inc: { enrolledCount: -n } } } })));
  }
  const results = await Promise.all([Grade, Attendance, Enrollment].map((Model) => Model.deleteMany({ student: studentId })));
  return results.reduce((total, r) => total + r.deletedCount, 0);
}

// Removes every academic record that belongs to a student (used when they are permanently deleted).
async function purgeStudentRecords(studentId) {
  const academic = await clearAcademicRecords(studentId);
  // Proofs of payment are files on disk: delete them along with the records that point at them.
  const proofs = await PaymentSubmission.find({ student: studentId }).select('proof');
  await Promise.all(proofs.map((p) => removeProof(p.proof)));
  const results = await Promise.all([Charge, Payment, Hold, PreEnrollment, PaymentSubmission].map((Model) => Model.deleteMany({ student: studentId })));
  return academic + results.reduce((total, r) => total + r.deletedCount, 0);
}

module.exports = { purgeStudentRecords, clearAcademicRecords };

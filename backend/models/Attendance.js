const mongoose = require('mongoose');
const { requiredRef, ref, isRealDate, baseOptions } = require('./_shared');

// One student's attendance at one class meeting. `date` is a calendar day ("2026-08-11"), kept as
// text so a time zone can never shift it to the previous or next day.
const attendanceSchema = new mongoose.Schema(
  {
    student: requiredRef('Student'),
    offering: requiredRef('Offering'),
    term: requiredRef('Term'), // filled in from the enrollment
    date: { type: String, required: [true, 'date is required'], validate: { validator: isRealDate, message: 'date must be a real date (YYYY-MM-DD)' } },
    status: { type: String, required: [true, 'status is required'], enum: { values: ['Present', 'Absent', 'Late', 'Excused'], message: 'status is invalid' } },
    remarks: { type: String, trim: true, maxlength: 200, default: '' },
    recordedBy: ref('User'),
  },
  baseOptions,
);

// Attendance only exists for a student who is actually enrolled in that offering.
attendanceSchema.pre('validate', async function checkEnrollment() {
  if (!(this.isNew || this.isModified('student') || this.isModified('offering'))) return undefined;
  const enrollment = await mongoose
    .model('Enrollment')
    .findOne({ student: this.student, offering: this.offering, status: { $ne: 'Dropped' } })
    .select('term');
  if (!enrollment) return this.invalidate('offering', 'the student is not enrolled in this offering');
  this.term = enrollment.term;
  return undefined;
});

attendanceSchema.index({ student: 1, offering: 1, date: 1 }, { unique: true }); // one record per class day
attendanceSchema.index({ offering: 1, date: 1 }); // a class's roll for a day
attendanceSchema.index({ student: 1, term: 1 }); // a student's attendance for a term

module.exports = mongoose.model('Attendance', attendanceSchema);

const mongoose = require('mongoose');
const { requiredRef, baseOptions } = require('./_shared');

// One student taking one offering. `term` and `subject` are copied from the offering so the database
// itself can enforce "one enrollment per student per subject per term" with a unique index.
const enrollmentSchema = new mongoose.Schema(
  {
    student: requiredRef('Student'),
    offering: requiredRef('Offering'),
    term: requiredRef('Term'), // filled in from the offering
    subject: requiredRef('Subject'), // filled in from the offering
    status: { type: String, default: 'Enrolled', enum: { values: ['Enrolled', 'Dropped', 'Completed'], message: 'status is invalid' } },
    enrolledAt: { type: Date, default: Date.now },
    droppedAt: { type: Date },
  },
  baseOptions,
);

enrollmentSchema.pre('validate', async function checkLinks() {
  if (this.isNew || this.isModified('offering')) {
    const offering = await mongoose.model('Offering').findById(this.offering).select('term subject');
    if (!offering) return this.invalidate('offering', 'offering does not exist');
    this.term = offering.term;
    this.subject = offering.subject;
  }
  if (this.isNew && !(await mongoose.model('Student').exists({ _id: this.student }))) {
    this.invalidate('student', 'student does not exist');
  }
  return undefined;
});

// The rule: a student takes a given subject at most once per term (any section).
enrollmentSchema.index({ student: 1, term: 1, subject: 1 }, { unique: true });
enrollmentSchema.index({ offering: 1, status: 1 }); // class lists
enrollmentSchema.index({ student: 1, term: 1 }); // a student's schedule for a term

module.exports = mongoose.model('Enrollment', enrollmentSchema);

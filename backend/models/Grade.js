const mongoose = require('mongoose');
const { requiredRef, ref, baseOptions } = require('./_shared');

// Philippine scale: 1.00 is excellent, 3.00 is the lowest pass, 5.00 is a fail.
const GRADE_VALUES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 5];
const PASSING_GRADE = 3;
const MARKS = ['INC', 'DRP', 'W']; // Incomplete, Dropped, Withdrawn: no numeric grade
const REMARKS = { INC: 'Incomplete', DRP: 'Dropped', W: 'Withdrawn' };

// The final grade of one enrollment. Exactly one of `value` (numeric) or `mark` (INC/DRP/W).
const gradeSchema = new mongoose.Schema(
  {
    student: requiredRef('Student'),
    enrollment: requiredRef('Enrollment'),
    term: requiredRef('Term'), // filled in from the enrollment
    subject: requiredRef('Subject'), // filled in from the enrollment
    value: { type: Number, enum: { values: GRADE_VALUES, message: 'value must be 1.00-3.00 in 0.25 steps, or 5.00' } },
    mark: { type: String, enum: { values: MARKS, message: 'mark must be INC, DRP or W' } },
    remark: { type: String, enum: ['Passed', 'Failed', 'Incomplete', 'Dropped', 'Withdrawn'] }, // derived
    postedBy: ref('User'),
    postedAt: { type: Date, default: Date.now },
  },
  baseOptions,
);

gradeSchema.pre('validate', async function checkLinks() {
  const hasValue = this.value !== undefined && this.value !== null;
  const hasMark = Boolean(this.mark);
  if (hasValue === hasMark) this.invalidate('value', 'give either a numeric grade or a mark (INC, DRP, W), not both and not neither');

  if (this.isNew || this.isModified('enrollment')) {
    const enrollment = await mongoose.model('Enrollment').findById(this.enrollment).select('student term subject status');
    if (!enrollment) return this.invalidate('enrollment', 'enrollment does not exist');
    if (!enrollment.student.equals(this.student)) return this.invalidate('student', 'this enrollment belongs to a different student');
    if (enrollment.status === 'Dropped') return this.invalidate('enrollment', 'a dropped enrollment cannot be graded');
    this.term = enrollment.term;
    this.subject = enrollment.subject;
  }

  if (hasMark) this.remark = REMARKS[this.mark];
  else if (hasValue) this.remark = this.value <= PASSING_GRADE ? 'Passed' : 'Failed';
  return undefined;
});

gradeSchema.index({ enrollment: 1 }, { unique: true }); // one final grade per enrollment
gradeSchema.index({ student: 1, term: 1 }); // a student's grades, grouped by semester
gradeSchema.index({ student: 1, subject: 1 }); // "did they pass the prerequisite?"

module.exports = mongoose.model('Grade', gradeSchema);
module.exports.GRADE_VALUES = GRADE_VALUES;
module.exports.PASSING_GRADE = PASSING_GRADE;

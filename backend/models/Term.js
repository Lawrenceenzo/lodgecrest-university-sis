const mongoose = require('mongoose');
const { SEMESTERS, baseOptions, idTransform } = require('./_shared');

// One semester of one academic year, e.g. "2026-2027 1st Semester".
const termSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: [true, 'academicYear is required'],
      match: [/^\d{4}-\d{4}$/, 'academicYear must look like 2026-2027'],
      validate: {
        validator: (v) => Number(v.slice(5)) === Number(v.slice(0, 4)) + 1,
        message: 'academicYear must span consecutive years (e.g. 2026-2027)',
      },
    },
    semester: { type: String, required: [true, 'semester is required'], enum: { values: SEMESTERS, message: 'semester is invalid' } },
    startDate: { type: Date, required: [true, 'startDate is required'] },
    endDate: {
      type: Date,
      required: [true, 'endDate is required'],
      validate: {
        validator(v) {
          return !this.startDate || v > this.startDate;
        },
        message: 'endDate must be after startDate',
      },
    },
    // The semester in progress. The database allows only ONE (partial unique index below).
    isCurrent: { type: Boolean, default: false },
    // Students may pre-enroll for this term while this is on.
    enrollmentOpen: { type: Boolean, default: false },
  },
  { ...baseOptions, toJSON: { virtuals: true, transform: idTransform } },
);

termSchema.virtual('name').get(function termName() {
  return `${this.academicYear} ${this.semester}`;
});

termSchema.index({ academicYear: 1, semester: 1 }, { unique: true });
termSchema.index({ isCurrent: 1 }, { unique: true, partialFilterExpression: { isCurrent: true } });

module.exports = mongoose.model('Term', termSchema);

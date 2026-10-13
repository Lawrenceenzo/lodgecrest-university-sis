const mongoose = require('mongoose');
const { ObjectId, ref, YEAR_LEVELS, SEMESTERS, baseOptions } = require('./_shared');

// Where a subject sits in a program's curriculum, e.g. BSIT / 2nd Year / 1st Semester.
// A general-education subject shared by several programs has several entries.
const placementSchema = new mongoose.Schema(
  {
    course: ref('Course', { required: [true, 'course is required'] }),
    yearLevel: { type: String, required: true, enum: { values: YEAR_LEVELS, message: 'yearLevel is invalid' } },
    semester: { type: String, required: true, enum: { values: SEMESTERS, message: 'semester is invalid' } },
  },
  { _id: false },
);

// A catalog entry: what is taught (not when or by whom - that is an Offering).
const subjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'code is required'],
      unique: true,
      trim: true,
      match: [/^[A-Za-z0-9]{2,12}$/, 'code must be 2-12 letters or digits'],
    },
    title: { type: String, required: [true, 'title is required'], trim: true, maxlength: 120 },
    units: {
      type: Number,
      required: [true, 'units is required'],
      min: [0, 'units must be 0-12'],
      max: [12, 'units must be 0-12'],
      validate: { validator: (v) => (v * 2) % 1 === 0, message: 'units must be a multiple of 0.5' },
    },
    // Some subjects (e.g. NSTP) carry units but are left out of the GWA.
    countsToGwa: { type: Boolean, default: true },
    prerequisites: [{ type: ObjectId, ref: 'Subject' }],
    curriculum: [placementSchema],
    description: { type: String, trim: true, maxlength: 500, default: '' },
  },
  baseOptions,
);

subjectSchema.path('prerequisites').validate({
  validator(list) {
    return !list.some((id) => id.equals(this._id));
  },
  message: 'a subject cannot be its own prerequisite',
});

// "Which subjects belong to BSIT, 2nd Year, 1st Semester?"
subjectSchema.index({ 'curriculum.course': 1, 'curriculum.yearLevel': 1, 'curriculum.semester': 1 });

module.exports = mongoose.model('Subject', subjectSchema);

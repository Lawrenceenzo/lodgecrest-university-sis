const mongoose = require('mongoose');

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SECTIONS = ['A', 'B', 'C'];
const STATUSES = ['Enrolled', 'Pending'];
// Where a student stands in their academic life. 'Archived' is the soft-delete state.
const ACADEMIC_STATUSES = ['Enrolled', 'LOA', 'Transferred', 'Graduated', 'Archived'];
const GENDERS = ['Male', 'Female', 'Other'];
const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];
const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV'];

// `''` is allowed where the frontend uses an empty value for "not set".
const oneOf = (values, { allowEmpty = false } = {}) => ({
  values: allowEmpty ? ['', ...values] : values,
  message: '{PATH} is invalid',
});

const text = (extra = {}) => ({ type: String, trim: true, maxlength: 120, default: '', ...extra });
const required = (path) => [true, `${path} is required`];

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: required('studentId'),
      unique: true,
      trim: true,
      match: [/^\d{4}-\d{4}$/, 'studentId must look like 2026-0001'],
    },

    // Personal information
    firstName: text({ required: required('firstName'), default: undefined }),
    middleName: text(),
    lastName: text({ required: required('lastName'), default: undefined }),
    suffix: { type: String, default: '', enum: oneOf(SUFFIXES, { allowEmpty: true }) },
    // Kept as "YYYY-MM-DD" text so it round-trips with <input type="date"> unchanged.
    dob: {
      type: String,
      required: required('dob'),
      match: [/^\d{4}-\d{2}-\d{2}$/, 'dob is not a valid date'],
      validate: {
        validator: (v) => !Number.isNaN(Date.parse(v)),
        message: 'dob is not a valid date',
      },
    },
    gender: { type: String, required: required('gender'), enum: oneOf(GENDERS) },
    civilStatus: { type: String, default: '', enum: oneOf(CIVIL_STATUSES, { allowEmpty: true }) },
    nationality: text(),
    religion: text(),

    // Contact information
    email: {
      type: String,
      required: required('email'),
      trim: true,
      maxlength: 120,
      match: [/^\S+@\S+\.\S+$/, 'email is invalid'],
    },
    contactNumber: text({ required: required('contactNumber'), default: undefined }),
    address: text({ required: required('address'), default: undefined, maxlength: 250 }),
    emergencyContact: {
      name: text(),
      phone: text(),
    },

    // Academic information (blank until the student is enrolled)
    course: { type: String, trim: true, default: '', match: [/^([A-Za-z0-9]{2,12})?$/, 'course is invalid'] },
    // The same program as a link to the Course record (by _id). `course` above stays as the short
    // code for display and filters; the API keeps the two in step.
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    yearLevel: { type: String, default: '', enum: oneOf(YEAR_LEVELS, { allowEmpty: true }) },
    section: { type: String, default: '', enum: oneOf(SECTIONS, { allowEmpty: true }) },
    // Admission step: Pending (not yet placed in a course) or Enrolled.
    status: { type: String, default: 'Pending', enum: oneOf(STATUSES) },

    // Lifecycle. Archived = soft-deleted. Archived and Transferred students are hidden from the
    // admin lists by default and cannot sign in to the student portal.
    academicStatus: { type: String, default: 'Enrolled', enum: oneOf(ACADEMIC_STATUSES), index: true },
    archivedAt: { type: Date },
    // What the student was before archiving, so "Restore" puts them back where they were.
    statusBeforeArchive: { type: String, default: '', enum: oneOf(['Enrolled', 'LOA', 'Transferred', 'Graduated'], { allowEmpty: true }) },

    // Set when an administrator generated sample enrollments and grades for this student (demo data).
    // Only that action sets it; it lets the admin screens say so and offer to remove the sample records.
    sampleRecordsAt: { type: Date },

    // URL path of the uploaded photo, e.g. "/uploads/<uuid>.png" ('' = no photo). Only the upload
    // route sets this; the pattern also stops any other value being stored.
    profilePicture: {
      type: String,
      default: '',
      match: [/^(\/uploads\/[A-Za-z0-9-]+\.(jpg|png))?$/, 'profilePicture is invalid'],
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    toJSON: {
      // The frontend expects a plain `id` and no Mongo internals.
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model('Student', studentSchema);
module.exports.YEAR_LEVELS = YEAR_LEVELS;
module.exports.SECTIONS = SECTIONS;
module.exports.ACADEMIC_STATUSES = ACADEMIC_STATUSES;

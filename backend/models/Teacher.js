const mongoose = require('mongoose');
const { baseOptions } = require('./_shared');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}][\p{L}\s.'-]*$/u;

// A faculty member. Sections name one as their adviser.
const teacherSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: [true, 'employeeId is required'], unique: true, trim: true, match: [/^EMP-\d{4,}$/, 'employeeId must look like EMP-0001'] },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be 2-80 characters'],
      maxlength: [80, 'name must be 2-80 characters'],
      match: [NAME_RE, 'name may contain letters, spaces, apostrophes, hyphens and periods only'],
    },
    department: { type: String, required: [true, 'department is required'], trim: true, maxlength: 120 },
    email: { type: String, required: [true, 'email is required'], unique: true, lowercase: true, trim: true, maxlength: 100, match: [EMAIL_RE, 'email is invalid'] },
    contactNumber: { type: String, trim: true, maxlength: 30, default: '' },
    status: { type: String, default: 'Active', enum: { values: ['Active', 'Inactive'], message: 'status is invalid' } },
  },
  baseOptions,
);

module.exports = mongoose.model('Teacher', teacherSchema);

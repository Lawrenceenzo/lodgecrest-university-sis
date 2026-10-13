const mongoose = require('mongoose');
const { baseOptions } = require('./_shared');

// A degree program (BSIT, BSCS, ...). Students point at it through Student.program.
const courseSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'code is required'],
      unique: true,
      trim: true,
      match: [/^[A-Za-z0-9]{2,12}$/, 'code must be 2-12 letters or digits'],
    },
    name: { type: String, required: [true, 'name is required'], trim: true, maxlength: 120 },
    department: { type: String, trim: true, maxlength: 120, default: '' },
    years: { type: Number, default: 4, min: [1, 'years must be 1-8'], max: [8, 'years must be 1-8'], validate: { validator: Number.isInteger, message: 'years must be a whole number' } },
    // Units a student must earn to graduate. Drives "units earned vs required" in the portal.
    totalUnits: { type: Number, required: [true, 'totalUnits is required'], min: [1, 'totalUnits must be at least 1'], max: 400, validate: { validator: Number.isInteger, message: 'totalUnits must be a whole number' } },
    active: { type: Boolean, default: true },
  },
  baseOptions,
);

module.exports = mongoose.model('Course', courseSchema);

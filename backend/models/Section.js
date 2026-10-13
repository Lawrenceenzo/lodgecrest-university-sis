const mongoose = require('mongoose');
const { requiredRef, baseOptions } = require('./_shared');
const { YEAR_LEVELS, SECTIONS } = require('./Student');

// A class section of a program: BSIT, 2nd Year, Section A, with an adviser. Students belong to one
// through their course, year level and section letter.
const sectionSchema = new mongoose.Schema(
  {
    course: requiredRef('Course'),
    yearLevel: { type: String, required: [true, 'yearLevel is required'], enum: { values: YEAR_LEVELS, message: 'yearLevel is invalid' } },
    name: { type: String, required: [true, 'section is required'], enum: { values: SECTIONS, message: 'section is invalid' } },
    adviser: requiredRef('Teacher'),
    capacity: { type: Number, default: 40, min: [1, 'capacity must be 1-100'], max: [100, 'capacity must be 1-100'], validate: { validator: Number.isInteger, message: 'capacity must be a whole number' } },
  },
  baseOptions,
);

// One section of each name per program and year.
sectionSchema.index({ course: 1, yearLevel: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);

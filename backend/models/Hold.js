const mongoose = require('mongoose');
const { requiredRef, ref, baseOptions } = require('./_shared');

const TYPES = ['Library', 'Accounting', 'Registrar', 'Guidance', 'Other'];

// An administrative block on a student's record (unreturned book, unpaid balance, ...).
const holdSchema = new mongoose.Schema(
  {
    student: requiredRef('Student'),
    type: { type: String, required: [true, 'type is required'], enum: { values: TYPES, message: 'type is invalid' } },
    reason: { type: String, required: [true, 'reason is required'], trim: true, maxlength: 300 },
    status: { type: String, default: 'Active', enum: { values: ['Active', 'Cleared'], message: 'status is invalid' } },
    placedAt: { type: Date, default: Date.now },
    placedBy: ref('User'),
    clearedAt: { type: Date },
    clearedBy: ref('User'),
  },
  baseOptions,
);

holdSchema.pre('validate', function stampClearance() {
  if (this.status === 'Cleared' && !this.clearedAt) this.clearedAt = new Date();
  if (this.status === 'Active') this.clearedAt = undefined;
});

// A student can have only ONE active hold of each type (several cleared ones are fine, as history).
holdSchema.index({ student: 1, type: 1 }, { unique: true, partialFilterExpression: { status: 'Active' } });
holdSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Hold', holdSchema);
module.exports.TYPES = TYPES;

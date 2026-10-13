const mongoose = require('mongoose');
const { requiredRef, ref, isMoney, baseOptions } = require('./_shared');

const CATEGORIES = ['Tuition', 'Miscellaneous', 'Laboratory', 'Other'];

// Money the student owes (a line on their statement of account).
const chargeSchema = new mongoose.Schema(
  {
    student: requiredRef('Student'),
    term: ref('Term'),
    category: { type: String, default: 'Other', enum: { values: CATEGORIES, message: 'category is invalid' } },
    description: { type: String, required: [true, 'description is required'], trim: true, maxlength: 160 },
    amount: { type: Number, required: [true, 'amount is required'], min: [0.01, 'amount must be at least 0.01'], validate: { validator: isMoney, message: 'amount can have at most 2 decimal places' } },
    dueDate: { type: Date },
  },
  baseOptions,
);

chargeSchema.index({ student: 1, term: 1 });

module.exports = mongoose.model('Charge', chargeSchema);
module.exports.CATEGORIES = CATEGORIES;

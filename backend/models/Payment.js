const mongoose = require('mongoose');
const { requiredRef, ref, isMoney, baseOptions } = require('./_shared');

const METHODS = ['Cash', 'Bank Transfer', 'GCash', 'Credit Card', 'Scholarship'];

// Money the student has paid (or had covered). Balance = total charges - total payments.
const paymentSchema = new mongoose.Schema(
  {
    student: requiredRef('Student'),
    term: ref('Term'),
    amount: { type: Number, required: [true, 'amount is required'], min: [0.01, 'amount must be at least 0.01'], validate: { validator: isMoney, message: 'amount can have at most 2 decimal places' } },
    method: { type: String, required: [true, 'method is required'], enum: { values: METHODS, message: 'method is invalid' } },
    receiptNo: { type: String, trim: true, maxlength: 40 }, // official receipt number; unique when present
    paidAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    recordedBy: ref('User'),
  },
  baseOptions,
);

paymentSchema.index({ student: 1, paidAt: 1 });
paymentSchema.index({ receiptNo: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.METHODS = METHODS;

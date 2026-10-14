const mongoose = require('mongoose');
const { requiredRef, ref, isMoney, isRealDate, baseOptions } = require('./_shared');

const STATUSES = ['Pending', 'Approved', 'Rejected'];
// What a student can pick when paying online or by deposit. (Scholarship credits are recorded by the office.)
const SUBMISSION_METHODS = ['Bank Transfer', 'GCash', 'Credit Card', 'Cash'];

// A student's claim "I paid this much, here is the proof". It changes nothing on the account by itself: only when an
// administrator approves it does a real Payment get recorded (and the balance drop).
const paymentSubmissionSchema = new mongoose.Schema(
  {
    student: requiredRef('Student'),
    term: ref('Term'),
    amount: { type: Number, required: [true, 'amount is required'], min: [0.01, 'amount must be at least 0.01'], max: [500000, 'amount must be 500,000 or less'], validate: { validator: isMoney, message: 'amount can have at most 2 decimal places' } },
    method: { type: String, required: [true, 'method is required'], enum: { values: SUBMISSION_METHODS, message: 'method is invalid' } },
    referenceNo: { type: String, required: [true, 'reference number is required'], trim: true, match: [/^[A-Za-z0-9-]{4,40}$/, 'reference number must be 4-40 letters, digits or hyphens'] },
    paidOn: { type: String, required: [true, 'date paid is required'], validate: { validator: isRealDate, message: 'date paid is not a valid date' } }, // "YYYY-MM-DD"
    note: { type: String, trim: true, maxlength: 200, default: '' },
    proof: { type: String, required: [true, 'proof of payment is required'], match: [/^[A-Za-z0-9-]+\.(jpg|png)$/, 'proof is invalid'] }, // file name inside the private proofs folder
    status: { type: String, default: 'Pending', enum: { values: STATUSES, message: 'status is invalid' } },
    submittedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
    decidedBy: ref('User'),
    reason: { type: String, trim: true, maxlength: 300, default: '' }, // why it was rejected
    payment: ref('Payment'), // the payment recorded when this was approved
    // The reference number (lower case) while the submission is Pending or Approved, so the same reference cannot be
    // used twice. Cleared when rejected, which frees the reference for a corrected resubmission.
    activeKey: { type: String },
  },
  baseOptions,
);

paymentSubmissionSchema.pre('validate', function setActiveKey() {
  this.activeKey = this.status === 'Rejected' || !this.referenceNo ? undefined : this.referenceNo.toLowerCase();
});

paymentSubmissionSchema.index({ activeKey: 1 }, { unique: true, sparse: true });
paymentSubmissionSchema.index({ student: 1, submittedAt: -1 });
paymentSubmissionSchema.index({ status: 1, submittedAt: 1 });

module.exports = mongoose.model('PaymentSubmission', paymentSubmissionSchema);
module.exports.STATUSES = STATUSES;
module.exports.SUBMISSION_METHODS = SUBMISSION_METHODS;

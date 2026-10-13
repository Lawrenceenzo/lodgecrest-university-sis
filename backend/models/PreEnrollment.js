const mongoose = require('mongoose');
const { requiredRef, ref, baseOptions } = require('./_shared');

const STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'];

// A student's request to take a set of classes next term. It does nothing by itself: when an
// administrator approves it, each class becomes a real Enrollment (and takes a seat).
const preEnrollmentSchema = new mongoose.Schema(
  {
    student: requiredRef('Student'),
    term: requiredRef('Term'),
    status: { type: String, default: 'Pending', enum: { values: STATUSES, message: 'status is invalid' } },
    items: {
      type: [
        new mongoose.Schema(
          {
            offering: requiredRef('Offering'),
            subject: requiredRef('Subject'),
            units: { type: Number, required: true, min: 0 }, // snapshot, so the request still reads right if the subject changes
          },
          { _id: false },
        ),
      ],
      validate: [
        { validator: (v) => v.length >= 1, message: 'choose at least one subject' },
        { validator: (v) => v.length <= 12, message: 'too many subjects in one request' },
        { validator: (v) => new Set(v.map((i) => String(i.offering))).size === v.length, message: 'a class appears twice in this request' },
      ],
    },
    totalUnits: { type: Number, required: true, min: 0 },
    submittedAt: { type: Date, default: Date.now },
    // Filled in when an admin approves or rejects, or the student cancels.
    decidedAt: { type: Date },
    decidedBy: ref('User'),
    note: { type: String, trim: true, maxlength: 300, default: '' }, // the reason for a rejection
    enrollments: [ref('Enrollment')], // what an approval created
  },
  baseOptions,
);

// A student has at most ONE pending request per term; older ones (approved, rejected, cancelled) are history.
preEnrollmentSchema.index({ student: 1, term: 1 }, { unique: true, partialFilterExpression: { status: 'Pending' } });
preEnrollmentSchema.index({ status: 1, submittedAt: 1 });
preEnrollmentSchema.index({ student: 1, submittedAt: -1 });

module.exports = mongoose.model('PreEnrollment', preEnrollmentSchema);
module.exports.STATUSES = STATUSES;

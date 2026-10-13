const mongoose = require('mongoose');
const { DAYS, TIME_RE, requiredRef, baseOptions } = require('./_shared');

const meetingSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, enum: { values: DAYS, message: 'day is invalid' } },
    start: { type: String, required: true, match: [TIME_RE, 'start must be HH:MM (24-hour)'] },
    end: { type: String, required: true, match: [TIME_RE, 'end must be HH:MM (24-hour)'] },
    room: { type: String, trim: true, maxlength: 40, default: '' },
  },
  { _id: false },
);

// A subject offered in a term, in a section, with a schedule and a professor:
// the thing students actually enroll in.
const offeringSchema = new mongoose.Schema(
  {
    term: requiredRef('Term'),
    subject: requiredRef('Subject'),
    section: { type: String, required: [true, 'section is required'], trim: true, match: [/^[A-Za-z0-9-]{1,10}$/, 'section must be 1-10 letters or digits'] },
    professor: { type: String, required: [true, 'professor is required'], trim: true, maxlength: 80 },
    capacity: { type: Number, default: 40, min: [1, 'capacity must be 1-300'], max: [300, 'capacity must be 1-300'], validate: { validator: Number.isInteger, message: 'capacity must be a whole number' } },
    // Seats taken = enrollments that are not Dropped. Changed ONLY by the enrollment service, with
    // atomic updates, so two students can never take the last seat.
    enrolledCount: { type: Number, default: 0, min: 0 },
    status: { type: String, default: 'Open', enum: { values: ['Open', 'Closed', 'Cancelled'], message: 'status is invalid' } },
    meetings: {
      type: [meetingSchema],
      validate: [
        { validator: (list) => list.length > 0, message: 'at least one meeting time is required' },
        { validator: (list) => list.every((m) => m.end > m.start), message: 'each meeting must end after it starts' },
        {
          // No two meetings of the same offering may overlap on the same day.
          validator(list) {
            return DAYS.every((day) => {
              const sorted = list.filter((m) => m.day === day).sort((a, b) => a.start.localeCompare(b.start));
              return sorted.every((m, i) => i === 0 || sorted[i - 1].end <= m.start);
            });
          },
          message: 'meetings of one offering cannot overlap',
        },
      ],
    },
  },
  baseOptions,
);

offeringSchema.path('enrolledCount').validate({
  validator(v) {
    return v <= this.capacity;
  },
  message: 'enrolledCount cannot exceed capacity',
});

// A subject can have several sections in a term, but each section only once.
offeringSchema.index({ term: 1, subject: 1, section: 1 }, { unique: true });
offeringSchema.index({ term: 1 });

module.exports = mongoose.model('Offering', offeringSchema);

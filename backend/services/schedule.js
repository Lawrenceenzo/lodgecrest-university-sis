// Class meetings look like { day: 'Mon', start: '08:00', end: '09:30' }. Times are zero-padded 24-hour
// text, so plain string comparison orders them correctly.

// Two meetings clash when they fall on the same day and their time ranges overlap.
// (Back-to-back classes, 09:00-10:00 then 10:00-11:00, do not clash.)
const meetingsOverlap = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;

// Do two offerings share any time?
const offeringsConflict = (a, b) => a.meetings.some((ma) => b.meetings.some((mb) => meetingsOverlap(ma, mb)));

// Every clashing pair in a list of offerings.
function findConflicts(offerings) {
  const pairs = [];
  for (let i = 0; i < offerings.length; i += 1) {
    for (let j = i + 1; j < offerings.length; j += 1) {
      if (offeringsConflict(offerings[i], offerings[j])) pairs.push([offerings[i], offerings[j]]);
    }
  }
  return pairs;
}

module.exports = { meetingsOverlap, offeringsConflict, findConflicts };

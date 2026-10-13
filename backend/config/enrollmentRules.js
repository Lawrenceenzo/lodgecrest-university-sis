// Unit-load rules for pre-enrollment, in one place.
module.exports = {
  MAX_UNITS: 24, // hard limit per term (counting classes the student already has that term)
  REGULAR_MIN_UNITS: 12, // below this the student is part-time: allowed, with a warning
  // Holds that stop a student from pre-enrolling. Other holds (Library, Guidance, Other) only show a warning.
  BLOCKING_HOLD_TYPES: ['Accounting', 'Registrar'],
};

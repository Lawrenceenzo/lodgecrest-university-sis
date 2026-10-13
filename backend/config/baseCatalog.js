// Programs the application knows about out of the box. The migration makes sure the first three exist
// (they are the ones the admin forms offer); the seed adds the rest for a realistic demo.
// totalUnits for BSIT equals the sum of the sample BSIT curriculum in seed/curriculum.js (131).
const BASE_COURSES = [
  { code: 'BSIT', name: 'BS Information Technology', department: 'College of Computing', years: 4, totalUnits: 131 },
  { code: 'BSCS', name: 'BS Computer Science', department: 'College of Computing', years: 4, totalUnits: 160 },
  { code: 'BSA', name: 'BS Accountancy', department: 'College of Business', years: 4, totalUnits: 150 },
];

const EXTRA_COURSES = [
  { code: 'BSBA', name: 'BS Business Administration', department: 'College of Business', years: 4, totalUnits: 150 },
  { code: 'BSCpE', name: 'BS Computer Engineering', department: 'College of Engineering', years: 5, totalUnits: 178 },
  { code: 'BSPsy', name: 'BS Psychology', department: 'College of Arts and Sciences', years: 4, totalUnits: 150 },
];

module.exports = { BASE_COURSES, EXTRA_COURSES };

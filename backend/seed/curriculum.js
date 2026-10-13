// Sample curriculum for the seed. [title, units, options]
//   options.prereqs  codes that must be passed first
//   options.gwa      false = carries units but is left out of the GWA (PE and NSTP)
// BSIT is complete (8 semesters, 131 units, which equals Course.totalUnits for BSIT). BSA is seeded
// through 3rd year 1st semester and BSCS through 1st year, enough for the sample students.

const SUBJECTS = {
  // General education, shared by every program
  GE101: ['Understanding the Self', 3],
  GE102: ['Readings in Philippine History', 3],
  GE103: ['The Contemporary World', 3],
  GE104: ['Mathematics in the Modern World', 3],
  GE105: ['Purposive Communication', 3],
  GE106: ['Art Appreciation', 3],
  GE107: ['Science, Technology and Society', 3],
  GE108: ['Ethics', 3],
  PE1: ['Physical Fitness and Wellness', 2, { gwa: false }],
  PE2: ['Rhythmic Activities', 2, { gwa: false, prereqs: ['PE1'] }],
  PE3: ['Individual and Dual Sports', 2, { gwa: false }],
  PE4: ['Team Sports', 2, { gwa: false }],
  NSTP1: ['National Service Training Program 1', 3, { gwa: false }],
  NSTP2: ['National Service Training Program 2', 3, { gwa: false, prereqs: ['NSTP1'] }],

  // BS Information Technology
  IT101: ['Introduction to Computing', 3],
  IT102: ['Computer Programming 1', 3],
  IT103: ['Computer Programming 2', 3, { prereqs: ['IT102'] }],
  IT104: ['Discrete Mathematics', 3],
  IT201: ['Data Structures and Algorithms', 3, { prereqs: ['IT103'] }],
  IT202: ['Database Systems', 3, { prereqs: ['IT103'] }],
  IT203: ['Networking Fundamentals', 3],
  IT204: ['Object-Oriented Programming', 3, { prereqs: ['IT201'] }],
  IT205: ['Web Systems and Technologies', 3],
  IT206: ['Human-Computer Interaction', 3],
  IT207: ['Information Management', 3, { prereqs: ['IT202'] }],
  IT301: ['Systems Analysis and Design', 3, { prereqs: ['IT201'] }],
  IT302: ['Software Engineering', 3, { prereqs: ['IT204'] }],
  IT303: ['Operating Systems', 3],
  IT304: ['Mobile Application Development', 3, { prereqs: ['IT204'] }],
  IT305: ['IT Elective 1', 3],
  IT306: ['Information Assurance and Security', 3],
  IT307: ['Applied Statistics', 3],
  IT308: ['Systems Integration and Architecture', 3],
  IT309: ['Cloud Computing', 3],
  IT310: ['IT Elective 2', 3],
  IT311: ['Technical Writing', 3],
  IT401: ['Capstone Project 1', 3, { prereqs: ['IT302'] }],
  IT402: ['Social and Professional Issues', 3],
  IT403: ['IT Elective 3', 3],
  IT404: ['Quality Assurance', 3],
  IT405: ['Practicum Orientation', 3],
  IT406: ['Capstone Project 2', 3, { prereqs: ['IT401'] }],
  IT407: ['IT Practicum', 6],
  IT408: ['IT Elective 4', 3],

  // BS Accountancy
  ACC101: ['Fundamentals of Accounting', 3],
  ACC102: ['Financial Accounting', 3, { prereqs: ['ACC101'] }],
  ACC201: ['Intermediate Accounting 1', 3, { prereqs: ['ACC102'] }],
  ACC202: ['Cost Accounting', 3],
  ACC203: ['Intermediate Accounting 2', 3, { prereqs: ['ACC201'] }],
  ACC204: ['Management Accounting', 3],
  ACC301: ['Advanced Accounting 1', 3, { prereqs: ['ACC203'] }],
  ACC302: ['Auditing Theory', 3],
  ACC303: ['Taxation', 3],
  BUS101: ['Basic Microeconomics', 3],
  BUS102: ['Business Law', 3],
  BUS201: ['Marketing Management', 3],

  // BS Computer Science
  CS101: ['Introduction to Computer Science', 3],
  CS102: ['Programming Fundamentals', 3],
  CS103: ['Data Structures', 3, { prereqs: ['CS102'] }],
  CS104: ['Discrete Structures', 3],
};

// Which subjects make up each semester of each program: [course, year (1-4), semester (1|2), codes]
const SLOTS = [
  ['BSIT', 1, 1, ['GE101', 'GE104', 'IT101', 'IT102', 'PE1', 'NSTP1']],
  ['BSIT', 1, 2, ['GE102', 'GE105', 'IT103', 'IT104', 'PE2', 'NSTP2']],
  ['BSIT', 2, 1, ['GE103', 'GE106', 'IT201', 'IT202', 'IT203', 'PE3']],
  ['BSIT', 2, 2, ['GE107', 'IT204', 'IT205', 'IT206', 'IT207', 'PE4']],
  ['BSIT', 3, 1, ['GE108', 'IT301', 'IT302', 'IT303', 'IT304', 'IT305']],
  ['BSIT', 3, 2, ['IT306', 'IT307', 'IT308', 'IT309', 'IT310', 'IT311']],
  ['BSIT', 4, 1, ['IT401', 'IT402', 'IT403', 'IT404', 'IT405']],
  ['BSIT', 4, 2, ['IT406', 'IT407', 'IT408']],

  ['BSA', 1, 1, ['GE101', 'GE104', 'ACC101', 'BUS101', 'PE1', 'NSTP1']],
  ['BSA', 1, 2, ['GE102', 'GE105', 'ACC102', 'BUS102', 'PE2', 'NSTP2']],
  ['BSA', 2, 1, ['GE103', 'GE106', 'ACC201', 'ACC202', 'PE3']],
  ['BSA', 2, 2, ['GE107', 'ACC203', 'ACC204', 'BUS201', 'PE4']],
  ['BSA', 3, 1, ['GE108', 'ACC301', 'ACC302', 'ACC303']],

  ['BSCS', 1, 1, ['GE101', 'GE104', 'CS101', 'CS102', 'PE1', 'NSTP1']],
  ['BSCS', 1, 2, ['GE102', 'GE105', 'CS103', 'CS104', 'PE2', 'NSTP2']],
];

module.exports = { SUBJECTS, SLOTS };

const Student = require('../models/Student');

// Students in these states may not use the portal. (LOA and Graduated students still can:
// a student on leave needs to see their balance, and a graduate needs their transcript.)
const PORTAL_BLOCKED = ['Archived', 'Transferred'];

// Returns null when the user may proceed, otherwise why not: 'inactive' | 'missing'.
// Admins are never affected.
async function portalAccessProblem(user) {
  if (user.role !== 'student') return null;
  const student = await Student.findById(user.student).select('academicStatus');
  if (!student) return 'missing';
  return PORTAL_BLOCKED.includes(student.academicStatus) ? 'inactive' : null;
}

const INACTIVE_MESSAGE = 'Your portal access is not active. Please contact the Registrar.';

module.exports = { PORTAL_BLOCKED, portalAccessProblem, INACTIVE_MESSAGE };

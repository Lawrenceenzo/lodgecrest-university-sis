const crypto = require('crypto');

// Rules shared by registration, change-password and generated passwords.
// Returns a list of problems (empty = acceptable).
function passwordProblems(password) {
  if (typeof password !== 'string' || password.length < 8) return ['password must be at least 8 characters'];
  const problems = [];
  // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
  if (Buffer.byteLength(password) > 72) problems.push('password must be at most 72 bytes');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) problems.push('password must contain at least one letter and one number');
  return problems;
}

// One-time password handed to a new student account. 12 characters from an alphabet without
// look-alikes (no 0/O, 1/l/I), drawn with a secure random generator, always letter + digit.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
function generateTempPassword(length = 12) {
  const alphabet = LETTERS + DIGITS;
  for (;;) {
    let out = '';
    for (let i = 0; i < length; i += 1) out += alphabet[crypto.randomInt(alphabet.length)];
    if (/[A-Za-z]/.test(out) && /\d/.test(out)) return out;
  }
}

module.exports = { passwordProblems, generateTempPassword };

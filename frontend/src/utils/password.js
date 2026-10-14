// The password rule, mirroring the server (backend/utils/password.js): at least 8 characters, with a letter and a number.
// Returns a message for the first problem, or '' when the password is fine.
export function passwordProblem(password) {
  if (password.length < 8) return 'Use at least 8 characters'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number'
  if (new TextEncoder().encode(password).length > 72) return 'Use 72 bytes or fewer (about 72 characters)'
  return ''
}

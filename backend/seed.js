// Fills MongoDB with sample data: students, a demo admin and student login, programs, the academic
// calendar, a curriculum, class offerings, enrollments with grades, attendance, statements of account
// and holds. The details live in seed/index.js.
//   npm run seed
// WARNING: this DELETES all existing data in those collections (and uploaded photos) first.
//
// Admin sign-in uses an emailed code, so the admin email must be an inbox you can open:
//   SEED_ADMIN_EMAIL     (defaults to EMAIL_USER, then admin@lodgecrest.edu)
//   SEED_ADMIN_PASSWORD  (defaults to admin123 - change it for anything beyond a demo)
//
// It also creates one demo STUDENT login (Maria Santos, student 2026-0001) so the student portal
// can be tried straight away:
//   SEED_STUDENT_EMAIL     (defaults to her e-mail in the sample data; not a real inbox)
//   SEED_STUDENT_PASSWORD  (defaults to student123)

require('dotenv').config();
const mongoose = require('mongoose');
const { runSeed } = require('./seed/index');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in .env');
  await mongoose.connect(process.env.MONGO_URI);
  await runSeed();
}

// Runs only when started directly (`npm run seed`), never because another file happened to require it.
if (require.main !== module) {
  module.exports = { main };
} else {
  main()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    if (err.errors) console.error(Object.values(err.errors).map((e) => `  - ${e.message}`).join('\n'));
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
}

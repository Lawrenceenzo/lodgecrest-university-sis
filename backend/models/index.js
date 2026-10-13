// Every model in one place. Requiring this registers them all with Mongoose (the Enrollment, Grade and
// Attendance integrity checks look other models up by name).
module.exports = {
  Student: require('./Student'),
  User: require('./User'),
  Course: require('./Course'),
  Term: require('./Term'),
  Subject: require('./Subject'),
  Offering: require('./Offering'),
  Enrollment: require('./Enrollment'),
  Grade: require('./Grade'),
  Attendance: require('./Attendance'),
  Charge: require('./Charge'),
  Payment: require('./Payment'),
  Hold: require('./Hold'),
  PreEnrollment: require('./PreEnrollment'),
  Teacher: require('./Teacher'),
  Section: require('./Section'),
};

const mongoose = require('mongoose');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = ['admin', 'student'];
const ROLE_LABELS = { admin: 'Administrator', student: 'Student' };

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be 2-60 characters'],
      maxlength: [60, 'name must be 2-60 characters'],
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
      match: [EMAIL_RE, 'email is invalid'],
    },
    // bcrypt hash, never the plain password. Hidden from queries unless `.select('+password')`.
    password: { type: String, required: [true, 'password is required'], select: false },
    // Access level. Admins use the management console; students get the read-only portal.
    role: { type: String, enum: { values: ROLES, message: 'role is invalid' }, default: 'admin' },
    // The student record this login belongs to (students only). One login per student.
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [
        function studentRequired() {
          return this.role === 'student';
        },
        'a student account must be linked to a student record',
      ],
    },
    // True while the account still has the temporary password an admin generated.
    mustChangePassword: { type: Boolean, default: false },
    // Sessions are revoked by bumping this number: a token only works while its `tv` claim equals it.
    // Bumped on password change/reset and when the sign-in e-mail changes. (Exact, unlike comparing
    // timestamps, which can miss a token issued in the same second as the change.)
    tokenVersion: { type: Number, default: 0 },
    // Audit information only: when the password last changed.
    passwordChangedAt: { type: Date, select: false },

    // Email OTP (two-step login). `otp` holds an HMAC of the code, not the code itself.
    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      // Never leak the hash or OTP state to API responses.
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.otp;
        delete ret.otpExpires;
        delete ret.otpAttempts;
        delete ret.passwordChangedAt;
        delete ret.tokenVersion;
        ret.roleLabel = ROLE_LABELS[ret.role] || ret.role;
        if (ret.student) ret.student = ret.student.toString();
        return ret;
      },
    },
  },
);

// One portal login per student (admins have no `student`, so they are left out of the index).
userSchema.index({ student: 1 }, { unique: true, partialFilterExpression: { student: { $type: 'objectId' } } });

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.EMAIL_RE = EMAIL_RE;

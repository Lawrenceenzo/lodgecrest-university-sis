const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { portalAccessProblem, INACTIVE_MESSAGE } = require('../utils/studentAccess');

// Expects "Authorization: Bearer <token>". The token must be valid AND its user must still
// exist in the database. The user's role comes from that database record; the `role` claim in
// the token is only a convenience for the client and is never trusted here.
//
// `enforcePasswordChange`: an account holding a temporary password may do nothing except change
// it. This is enforced here, on the server, so it can't be skipped by typing a URL.
function build({ enforcePasswordChange }) {
  return async function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let user;
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(payload.id);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    // A password change, an admin reset or a changed sign-in e-mail signs out every earlier session.
    // Tokens issued before versions existed carry no `tv` and count as version 0.
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: 'Your session has ended. Please sign in again.' });
    }

    // A student who is archived or has transferred loses access immediately, even mid-session.
    const problem = await portalAccessProblem(user);
    if (problem === 'missing') return res.status(401).json({ message: 'User no longer exists' });
    if (problem === 'inactive') return res.status(403).json({ message: INACTIVE_MESSAGE, code: 'ACCOUNT_INACTIVE' });

    if (enforcePasswordChange && user.mustChangePassword) {
      return res.status(403).json({ message: 'You must change your temporary password first', code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    req.user = user.toJSON();
    next();
  };
}

const authenticate = build({ enforcePasswordChange: true });
// For the few endpoints a user with a temporary password may still call (/me, change-password).
authenticate.allowPasswordChange = build({ enforcePasswordChange: false });

module.exports = authenticate;

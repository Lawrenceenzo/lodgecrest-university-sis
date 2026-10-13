// Use after `authenticate`:  router.use(authenticate, requireRole('admin'))
// The role is read from the database record that `authenticate` loaded - never from the token -
// so a forged or stale token can't grant access.
const requireRole = (...allowed) => (req, res, next) => {
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to do that' });
  }
  next();
};

module.exports = requireRole;

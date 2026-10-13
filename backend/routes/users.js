const express = require('express');
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// GET /api/users -> all registered users (admins and student logins) (password and OTP fields are never selected)
router.get('/', async (req, res) => {
  res.json(await User.find().sort({ createdAt: 1 }));
});

module.exports = router;

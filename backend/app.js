const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const userRoutes = require('./routes/users');
const recordRoutes = require('./routes/records');
const portalRoutes = require('./routes/portal');
const catalogRoutes = require('./routes/catalog');
const preEnrollmentRoutes = require('./routes/preEnrollments');
const { UPLOAD_DIR } = require('./middleware/upload');

const app = express();

// Vite dev server runs on 5173 by default.
// Content-Disposition is exposed so the portal can read the file name of a downloaded transcript.
app.use(cors({
  origin: [
    'https://lodgecrest-university-sis.vercel.app',
    'http://localhost:5173',
    process.env.CLIENT_ORIGIN
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());

// Uploaded student photos, e.g. GET /uploads/<uuid>.png. Names are random, only images are ever
// stored here, and nosniff stops browsers from treating a file as anything but an image.
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    index: false,
    dotfiles: 'ignore',
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  }),
);

// Health check (supports both with and without /api)
app.get('/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 }));

// Mount all routes with and without /api prefix for maximum compatibility
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

app.use('/students', studentRoutes);
app.use('/api/students', studentRoutes);

app.use('/users', userRoutes);
app.use('/api/users', userRoutes);

app.use('/pre-enrollments', preEnrollmentRoutes);
app.use('/api/pre-enrollments', preEnrollmentRoutes);

app.use('/portal', portalRoutes);
app.use('/api/portal', portalRoutes);

app.use('/', recordRoutes);
app.use('/api', catalogRoutes); // admin catalog: courses, subjects, teachers, sections
app.use('/api', recordRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Turns Mongoose / body-parser failures into clean JSON errors.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: 'Validation failed', errors: Object.values(err.errors).map((e) => e.message) });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `${err.path} is invalid` });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    return res.status(409).json({ message: `A record with this ${field} already exists` });
  }
  // A business rule was broken (class full, schedule clash, prerequisite not passed, ...).
  if (err.name === 'EnrollmentError') {
    return res.status(err.status).json({ message: err.message, code: err.code, ...(err.problems ? { problems: err.problems, warnings: err.warnings || [] } : {}) });
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({ message: tooBig ? 'Photo must be 2 MB or smaller' : `Upload failed: ${err.message}` });
  }
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ message: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: 'Internal server error' });
});

module.exports = app;
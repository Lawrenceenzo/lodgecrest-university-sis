const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Photos are saved on disk here and served at /uploads/<file> (see server.js).
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB, matching the "JPG or PNG (Max 2MB)" hint in the form

// Allowed types. `isImage` checks the file's real first bytes, because the MIME type that the
// browser sends is only a claim and can be faked.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TYPES = {
  'image/jpeg': { ext: '.jpg', isImage: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: '.png', isImage: (b) => b.subarray(0, 8).equals(PNG_SIGNATURE) },
};

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // The original file name is ignored: a random name can't clash, can't be guessed, and can't
  // carry path tricks such as "../". The extension comes from the validated MIME type.
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${TYPES[file.mimetype].ext}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (TYPES[file.mimetype]) return cb(null, true);
    cb(Object.assign(new Error('Photo must be a JPG or PNG image'), { code: 'INVALID_FILE_TYPE' }));
  },
});

// URL path stored in MongoDB for an uploaded file, e.g. "/uploads/3f2c....png".
const publicPath = (file) => `/uploads/${file.filename}`;

// Deletes a previously stored upload. Only paths of the exact shape we generate are accepted,
// so a bad value in the database can never make this delete anything else.
async function removeUpload(storedPath) {
  if (typeof storedPath !== 'string' || !/^\/uploads\/[A-Za-z0-9-]+\.(jpg|png)$/.test(storedPath)) return;
  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(storedPath)));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not delete upload:', err.message);
  }
}

// After multer has saved the file, confirm it really is a JPG/PNG; otherwise delete it.
async function verifyImage(req, res, next) {
  if (!req.file) return next();

  const handle = await fs.promises.open(req.file.path, 'r');
  const head = Buffer.alloc(8);
  try {
    await handle.read(head, 0, 8, 0);
  } finally {
    await handle.close();
  }

  if (!TYPES[req.file.mimetype].isImage(head)) {
    await removeUpload(publicPath(req.file));
    return res.status(400).json({ message: 'The file is not a valid JPG or PNG image' });
  }
  next();
}

// Use as route middleware: reads the single form field named "photo" into req.file.
// Requests that are not multipart (plain JSON) pass straight through untouched.
const uploadPhoto = [upload.single('photo'), verifyImage];

module.exports = { uploadPhoto, publicPath, removeUpload, UPLOAD_DIR, MAX_BYTES };

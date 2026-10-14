const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Proofs of payment (receipt photos and screenshots). Unlike profile photos these are NOT in the public
// uploads folder and no URL serves them: they can only be read through the API, by the student who sent
// one or by an administrator (see routes/portal.js and routes/paymentSubmissions.js).
// PAYMENT_PROOF_DIR moves it elsewhere (the tests use a temporary folder, so running them can never touch real proofs).
const PROOF_DIR = process.env.PAYMENT_PROOF_DIR ? path.resolve(process.env.PAYMENT_PROOF_DIR) : path.join(__dirname, '..', 'private', 'payment-proofs');
fs.mkdirSync(PROOF_DIR, { recursive: true });

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB: a phone photo of a receipt is often bigger than a profile picture

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// `isImage` looks at the file's real first bytes; the MIME type the browser sends is only a claim.
const TYPES = {
  'image/jpeg': { ext: '.jpg', contentType: 'image/jpeg', isImage: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: '.png', contentType: 'image/png', isImage: (b) => b.subarray(0, 8).equals(PNG_SIGNATURE) },
};

const STORED_NAME = /^[A-Za-z0-9-]+\.(jpg|png)$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: PROOF_DIR,
    // A random name: it cannot clash, be guessed, or carry path tricks such as "../".
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${TYPES[file.mimetype].ext}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (TYPES[file.mimetype]) return cb(null, true);
    cb(Object.assign(new Error('Proof of payment must be a JPG or PNG image'), { code: 'INVALID_FILE_TYPE' }));
  },
});

// The absolute path of a stored proof, or null if the stored value is not one of our own file names.
const proofPath = (storedName) => (typeof storedName === 'string' && STORED_NAME.test(storedName) ? path.join(PROOF_DIR, storedName) : null);

async function removeProof(storedName) {
  const file = proofPath(storedName);
  if (!file) return;
  try {
    await fs.promises.unlink(file);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not delete proof of payment:', err.message);
  }
}

// After multer has saved the file, confirm it really is a JPG/PNG; otherwise delete it.
async function verifyProofImage(req, res, next) {
  if (!req.file) return next();
  const handle = await fs.promises.open(req.file.path, 'r');
  const head = Buffer.alloc(8);
  try {
    await handle.read(head, 0, 8, 0);
  } finally {
    await handle.close();
  }
  if (!TYPES[req.file.mimetype].isImage(head)) {
    await removeProof(req.file.filename);
    return res.status(400).json({ message: 'The file is not a valid JPG or PNG image' });
  }
  return next();
}

// Route middleware: reads the form field "proof" into req.file.
const uploadProof = [upload.single('proof'), verifyProofImage];

module.exports = { uploadProof, proofPath, removeProof, PROOF_DIR, MAX_BYTES, TYPES };

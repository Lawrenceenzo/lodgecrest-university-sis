// Loaded first by every test file. Proofs of payment go to a throwaway folder, because the seed (which the
// tests run) deletes every file in the proofs folder, and that must never be the real one.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

if (!process.env.PAYMENT_PROOF_DIR) process.env.PAYMENT_PROOF_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sis-proofs-'));

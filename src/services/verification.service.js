const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { VerificationRequest, Worker } = require('../models');

const privateDirectory = path.resolve(__dirname, '../../uploads/private/verification');
const fileTypes = [
  { mime: 'application/pdf', extension: 'pdf', signature: (buffer) => buffer.subarray(0, 5).toString() === '%PDF-' },
  { mime: 'image/jpeg', extension: 'jpg', signature: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  { mime: 'image/png', extension: 'png', signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', extension: 'webp', signature: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
];

function identifyFile(buffer) {
  return fileTypes.find((type) => type.signature(buffer));
}

async function submitVerificationRequest(userId, files, evidenceSummary = '') {
  const worker = await Worker.findOne({ user: userId }).exec();
  if (!worker) return { error: 'WORKER_PROFILE_NOT_FOUND' };
  if (worker.verificationStatus === 'verified') return { error: 'ALREADY_VERIFIED' };
  if (worker.verificationStatus === 'pending') return { error: 'REQUEST_PENDING' };
  if (!files.length) return { error: 'DOCUMENTS_REQUIRED' };

  const detectedFiles = files.map((file) => {
    const type = identifyFile(file.buffer);
    if (!type || type.mime !== file.mimetype) {
      const error = new Error('A file did not match its declared type. Upload a valid PDF, JPEG, PNG, or WebP.');
      error.statusCode = 415;
      error.code = 'INVALID_FILE_CONTENT';
      throw error;
    }
    return { file, type };
  });

  await fs.mkdir(privateDirectory, { recursive: true });
  const storedFiles = [];
  let createdRequest;
  try {
    for (const { file, type } of detectedFiles) {
      const storageKey = `${crypto.randomUUID()}.${type.extension}`;
      const absolutePath = path.join(privateDirectory, storageKey);
      await fs.writeFile(absolutePath, file.buffer, { flag: 'wx', mode: 0o600 });
      storedFiles.push({ storageKey, contentType: type.mime, sizeBytes: file.size, absolutePath });
    }

    createdRequest = await VerificationRequest.create({
      worker: worker._id,
      submittedBy: userId,
      evidenceSummary,
      documents: storedFiles.map(({ storageKey, contentType, sizeBytes }) => ({ storageKey, contentType, sizeBytes })),
      status: 'pending',
    });
    worker.verificationStatus = 'pending';
    await worker.save();
    return { request: createdRequest };
  } catch (error) {
    if (createdRequest) await VerificationRequest.deleteOne({ _id: createdRequest._id }).catch(() => {});
    await Promise.all(storedFiles.map(({ absolutePath }) => fs.unlink(absolutePath).catch(() => {})));
    throw error;
  }
}

function getPrivateDirectory() {
  return privateDirectory;
}

module.exports = { getPrivateDirectory, submitVerificationRequest };

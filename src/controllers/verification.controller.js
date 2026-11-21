const { submitVerificationRequest } = require('../services/verification.service');

async function submitMyVerification(req, res, next) {
  try {
    const result = await submitVerificationRequest(req.user._id, req.files || [], req.body.evidenceSummary || '');
    if (result.error === 'WORKER_PROFILE_NOT_FOUND') {
      return res.status(404).json({ error: { code: result.error, message: 'Worker profile not found.' } });
    }
    if (result.error === 'ALREADY_VERIFIED') {
      return res.status(409).json({ error: { code: result.error, message: 'This worker profile is already verified.' } });
    }
    if (result.error === 'REQUEST_PENDING') {
      return res.status(409).json({ error: { code: result.error, message: 'A verification request is already under review.' } });
    }
    if (result.error === 'DOCUMENTS_REQUIRED') {
      return res.status(400).json({ error: { code: result.error, message: 'Upload at least one verification document.' } });
    }
    return res.status(201).json({ data: { id: String(result.request._id), status: result.request.status, submittedAt: result.request.createdAt } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { submitMyVerification };

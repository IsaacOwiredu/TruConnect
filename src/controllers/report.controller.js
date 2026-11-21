const mongoose = require('mongoose');
const { Report, Worker } = require('../models');

async function reportWorker(req, res) {
  const worker = await Worker.findById(req.params.id).select('_id user').lean();
  if (!worker) return res.status(404).json({ error: { code: 'WORKER_NOT_FOUND', message: 'Professional profile not found.' } });
  if (String(worker.user) === String(req.user._id)) {
    return res.status(400).json({ error: { code: 'CANNOT_REPORT_SELF', message: 'You cannot report your own professional profile.' } });
  }

  const report = await Report.create({
    reporter: req.user._id,
    targetUser: worker.user,
    targetWorker: new mongoose.Types.ObjectId(worker._id),
    reason: req.body.reason,
    details: req.body.details,
  });
  return res.status(201).json({ data: { id: String(report._id), status: report.status } });
}

module.exports = { reportWorker };

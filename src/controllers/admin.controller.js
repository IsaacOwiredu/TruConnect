const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { Report, Review, ServiceCategory, User, VerificationRequest, Worker } = require('../models');
const { getPrivateDirectory } = require('../services/verification.service');

async function getMetrics(req, res) {
  const [users, workers, verifiedWorkers, pendingVerifications, rejectedVerifications, openReports] = await Promise.all([
    User.countDocuments({ role: { $in: ['customer', 'worker'] } }),
    Worker.countDocuments(),
    Worker.countDocuments({ verificationStatus: 'verified' }),
    VerificationRequest.countDocuments({ status: 'pending' }),
    VerificationRequest.countDocuments({ status: 'rejected' }),
    Report.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
  ]);
  res.json({ data: { users, workers, verifiedWorkers, pendingVerifications, rejectedVerifications, openReports } });
}

async function listUsers(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.accountStatus = req.query.status;
  if (req.query.q) filter.$or = [
    { fullName: new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    { email: new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
  ];

  const [items, total] = await Promise.all([
    User.find(filter).select('_id fullName email role accountStatus createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    User.countDocuments(filter),
  ]);
  res.json({ data: items, meta: { total, page, limit } });
}

async function setUserStatus(req, res) {
  const userId = req.params.id;
  if (!mongoose.isValidObjectId(userId)) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Account not found.' } });
  if (String(req.user._id) === userId && req.body.accountStatus === 'suspended') {
    return res.status(400).json({ error: { code: 'CANNOT_SUSPEND_SELF', message: 'You cannot suspend your own account.' } });
  }

  const user = await User.findById(userId).exec();
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Account not found.' } });
  if (user.role === 'admin' && req.body.accountStatus === 'suspended') {
    const activeAdmins = await User.countDocuments({ role: 'admin', accountStatus: 'active' });
    if (activeAdmins <= 1) return res.status(409).json({ error: { code: 'LAST_ACTIVE_ADMIN', message: 'The last active administrator cannot be suspended.' } });
  }

  user.accountStatus = req.body.accountStatus;
  await user.save();
  return res.json({ data: { id: String(user._id), accountStatus: user.accountStatus } });
}

async function listVerificationRequests(req, res) {
  const filter = req.query.status ? { status: req.query.status } : {};
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const [requests, total] = await Promise.all([
    VerificationRequest.find(filter)
      .select('+documents +reviewNote')
      .populate({ path: 'worker', select: 'user location verificationStatus', populate: { path: 'user', select: 'fullName email' } })
      .populate({ path: 'submittedBy', select: 'fullName email' })
      .populate({ path: 'reviewedBy', select: 'fullName' })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    VerificationRequest.countDocuments(filter),
  ]);
  const data = requests.map((request) => ({
    ...request,
    documentCount: request.documents?.length || 0,
    documents: (request.documents || []).map((document) => ({
      downloadUrl: `/api/v1/admin/verification-requests/${request._id}/documents/${encodeURIComponent(document.storageKey)}`,
    })),
  }));
  res.json({ data, meta: { total, page, limit } });
}

async function downloadVerificationDocument(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Verification document not found.' } });
  const request = await VerificationRequest.findById(req.params.id).select('+documents').lean().exec();
  const document = request?.documents?.find((item) => item.storageKey === req.params.storageKey);
  if (!document || path.basename(document.storageKey) !== document.storageKey) {
    return res.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Verification document not found.' } });
  }

  const absolutePath = path.resolve(getPrivateDirectory(), document.storageKey);
  if (!absolutePath.startsWith(`${getPrivateDirectory()}${path.sep}`)) {
    return res.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Verification document not found.' } });
  }
  res.set({
    'Cache-Control': 'no-store',
    'Content-Type': document.contentType,
    'Content-Security-Policy': 'sandbox',
    'X-Content-Type-Options': 'nosniff',
  });
  return res.download(absolutePath, document.storageKey, (error) => {
    if (error && !res.headersSent) next(error);
  });
}

async function reviewVerification(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: { code: 'REQUEST_NOT_FOUND', message: 'Verification request not found.' } });
  const request = await VerificationRequest.findById(req.params.id).select('+reviewNote').exec();
  if (!request) return res.status(404).json({ error: { code: 'REQUEST_NOT_FOUND', message: 'Verification request not found.' } });
  if (request.status !== 'pending') return res.status(409).json({ error: { code: 'REQUEST_ALREADY_REVIEWED', message: 'This verification request has already been reviewed.' } });

  const priorStatus = request.status;
  request.status = req.body.status;
  request.reviewNote = req.body.reviewNote || '';
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  await request.save();

  try {
    const workerStatus = req.body.status === 'approved' ? 'verified' : 'rejected';
    const result = await Worker.updateOne({ _id: request.worker }, { $set: { verificationStatus: workerStatus } });
    if (!result.matchedCount) throw new Error('The worker profile for this request no longer exists.');
  } catch (error) {
    request.status = priorStatus;
    request.reviewNote = '';
    request.reviewedBy = null;
    request.reviewedAt = null;
    await request.save().catch(() => {});
    throw error;
  }

  return res.json({ data: { id: String(request._id), status: request.status, reviewedAt: request.reviewedAt } });
}

async function listReviews(req, res) {
  const filter = req.query.status ? { moderationStatus: req.query.status } : {};
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const [items, total] = await Promise.all([
    Review.find(filter).populate('customer', 'fullName email').populate({ path: 'worker', select: 'user', populate: { path: 'user', select: 'fullName email' } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Review.countDocuments(filter),
  ]);
  res.json({ data: items, meta: { total, page, limit } });
}

async function moderateReview(req, res) {
  const review = await Review.findById(req.params.id).exec();
  if (!review) return res.status(404).json({ error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found.' } });
  review.moderationStatus = req.body.moderationStatus;
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();
  await review.save();
  return res.json({ data: { id: String(review._id), moderationStatus: review.moderationStatus } });
}

async function listReports(req, res) {
  const filter = req.query.status ? { status: req.query.status } : {};
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const [items, total] = await Promise.all([
    Report.find(filter).select('+resolutionNote').populate('reporter', 'fullName email').populate('targetUser', 'fullName email role accountStatus').populate('reviewedBy', 'fullName').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Report.countDocuments(filter),
  ]);
  res.json({ data: items, meta: { total, page, limit } });
}

async function updateReport(req, res) {
  const report = await Report.findById(req.params.id).select('+resolutionNote').exec();
  if (!report) return res.status(404).json({ error: { code: 'REPORT_NOT_FOUND', message: 'Report not found.' } });
  report.status = req.body.status;
  report.resolutionNote = req.body.resolutionNote || '';
  report.reviewedBy = req.user._id;
  report.reviewedAt = new Date();
  await report.save();
  return res.json({ data: { id: String(report._id), status: report.status } });
}

async function getCategories(req, res) {
  const items = await ServiceCategory.find().sort({ sortOrder: 1, name: 1 }).lean().exec();
  res.json({ data: items });
}

async function createCategory(req, res) {
  const category = await ServiceCategory.create({
    name: req.body.name,
    slug: req.body.slug,
    description: req.body.description || '',
    icon: req.body.icon || '',
    sortOrder: req.body.sortOrder || 0,
  });
  return res.status(201).json({ data: category });
}

async function updateCategory(req, res) {
  const category = await ServiceCategory.findByIdAndUpdate(req.params.id, {
    $set: {
      ...(req.body.name !== undefined ? { name: req.body.name } : {}),
      ...(req.body.slug !== undefined ? { slug: req.body.slug } : {}),
      ...(req.body.description !== undefined ? { description: req.body.description } : {}),
      ...(req.body.icon !== undefined ? { icon: req.body.icon } : {}),
      ...(req.body.sortOrder !== undefined ? { sortOrder: req.body.sortOrder } : {}),
      ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
    },
  }, { new: true, runValidators: true }).exec();
  if (!category) return res.status(404).json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Service category not found.' } });
  return res.json({ data: category });
}

async function getActivity(req, res) {
  const [verifications, reports, reviews] = await Promise.all([
    VerificationRequest.find().select('status createdAt worker').populate({ path: 'worker', populate: { path: 'user', select: 'fullName' } }).sort({ createdAt: -1 }).limit(5).lean().exec(),
    Report.find().select('status reason createdAt targetUser').populate('targetUser', 'fullName').sort({ createdAt: -1 }).limit(5).lean().exec(),
    Review.find().select('moderationStatus rating createdAt worker').populate({ path: 'worker', populate: { path: 'user', select: 'fullName' } }).sort({ createdAt: -1 }).limit(5).lean().exec(),
  ]);
  const data = [
    ...verifications.map((item) => ({ kind: 'verification', status: item.status, createdAt: item.createdAt, subject: item.worker?.user?.fullName || 'Worker profile' })),
    ...reports.map((item) => ({ kind: 'report', status: item.status, createdAt: item.createdAt, subject: item.targetUser?.fullName || 'Account', reason: item.reason })),
    ...reviews.map((item) => ({ kind: 'review', status: item.moderationStatus, createdAt: item.createdAt, subject: item.worker?.user?.fullName || 'Worker profile', rating: item.rating })),
  ].sort((first, second) => second.createdAt - first.createdAt).slice(0, 10);
  res.json({ data });
}

module.exports = {
  createCategory,
  downloadVerificationDocument,
  getActivity,
  getCategories,
  getMetrics,
  listReports,
  listReviews,
  listUsers,
  listVerificationRequests,
  moderateReview,
  reviewVerification,
  setUserStatus,
  updateCategory,
  updateReport,
};

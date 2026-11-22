const mongoose = require('mongoose');
const { Review, Worker } = require('../models');
const asyncHandler = require('../middleware/async-handler');
const { findPublicWorker, findWorkerProfileForUser, findWorkers, listApprovedReviews, updateWorkerProfile, updateWorkerProfileImage } = require('../services/worker.service');

function queryFilters(query) {
  return {
    search: query.q || '',
    location: query.location || '',
    category: query.category || '',
    availability: query.availability || '',
    verifiedOnly: ['true', '1'].includes(query.verified),
    minRating: Number(query.minRating || 0),
    sort: query.sort || 'recommended',
    page: Number(query.page || 1),
    limit: Number(query.limit || 12),
  };
}

const listWorkers = asyncHandler(async (req, res) => {
  const result = await findWorkers(queryFilters(req.query));
  res.json({ data: result.items, meta: { total: result.total, page: Number(req.query.page || 1), limit: Number(req.query.limit || 12) } });
});

const getWorker = asyncHandler(async (req, res) => {
  const worker = await findPublicWorker(req.params.id);
  if (!worker) return res.status(404).json({ error: { code: 'WORKER_NOT_FOUND', message: 'Professional profile not found.' } });
  return res.json({ data: worker });
});

const getMyProfile = asyncHandler(async (req, res) => {
  const worker = await findWorkerProfileForUser(req.user._id);
  if (!worker) return res.status(404).json({ error: { code: 'WORKER_PROFILE_NOT_FOUND', message: 'Worker profile not found.' } });
  return res.json({ data: { ...worker.toObject(), user: { id: String(req.user._id), fullName: req.user.fullName, email: req.user.email } } });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const worker = await updateWorkerProfile(req.user._id, req.body);
  if (!worker) return res.status(404).json({ error: { code: 'WORKER_PROFILE_NOT_FOUND', message: 'Worker profile not found.' } });
  return res.json({ data: { ...worker.toObject(), user: { id: String(req.user._id), fullName: req.user.fullName, email: req.user.email } } });
});

const updateMyProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: { code: 'PROFILE_IMAGE_REQUIRED', message: 'Choose a profile image to upload.' } });
  const worker = await updateWorkerProfileImage(req.user._id, req.file);
  if (!worker) return res.status(404).json({ error: { code: 'WORKER_PROFILE_NOT_FOUND', message: 'Worker profile not found.' } });
  return res.json({ data: { ...worker.toObject(), user: { id: String(req.user._id), fullName: req.user.fullName, email: req.user.email } } });
});

const getWorkerReviews = asyncHandler(async (req, res) => {
  const result = await listApprovedReviews(req.params.id, Number(req.query.page || 1), Number(req.query.limit || 10));
  if (!result) return res.status(404).json({ error: { code: 'WORKER_NOT_FOUND', message: 'Professional profile not found.' } });
  return res.json({ data: result.items, meta: { total: result.total } });
});

const submitReview = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: { code: 'WORKER_NOT_FOUND', message: 'Professional profile not found.' } });
  }
  const worker = await Worker.findById(req.params.id)
    .select('_id user')
    .populate({ path: 'user', match: { role: 'worker', accountStatus: 'active' }, select: '_id' })
    .lean()
    .exec();
  if (!worker?.user) return res.status(404).json({ error: { code: 'WORKER_NOT_FOUND', message: 'Professional profile not found.' } });

  let review;
  try {
    review = await Review.create({
      customer: req.user._id,
      worker: worker._id,
      rating: req.body.rating,
      body: req.body.body,
      moderationStatus: 'pending',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: { code: 'REVIEW_ALREADY_SUBMITTED', message: 'You have already reviewed this professional.' } });
    }
    throw error;
  }
  return res.status(201).json({ data: { id: String(review._id), moderationStatus: review.moderationStatus } });
});

module.exports = { getMyProfile, getWorker, getWorkerReviews, listWorkers, submitReview, updateMyProfile, updateMyProfileImage };

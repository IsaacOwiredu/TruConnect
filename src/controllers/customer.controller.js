const { Review } = require('../models');
const asyncHandler = require('../middleware/async-handler');

const listMyReviews = asyncHandler(async (req, res) => {
  const items = await Review.find({ customer: req.user._id })
    .populate({ path: 'worker', select: 'user', populate: { path: 'user', select: 'fullName' } })
    .select('worker rating body moderationStatus createdAt')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
    .exec();
  res.json({ data: items.map((review) => ({
    id: String(review._id),
    workerName: review.worker?.user?.fullName || 'Professional profile',
    workerId: review.worker?._id ? String(review.worker._id) : null,
    rating: review.rating,
    body: review.body,
    status: review.moderationStatus,
    createdAt: review.createdAt,
  })) });
});

module.exports = { listMyReviews };

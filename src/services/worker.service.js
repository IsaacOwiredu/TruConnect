const mongoose = require('mongoose');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Review, ServiceCategory, Worker } = require('../models');

const publicProfileImageDirectory = path.resolve(__dirname, '../../public/uploads/profiles');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function profilePipeline(workerId, filters = {}) {
  const initialMatch = workerId ? { _id: new mongoose.Types.ObjectId(workerId) } : {};
  const pipeline = [
    { $match: initialMatch },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.role': 'worker', 'user.accountStatus': 'active' } },
  ];

  if (filters.search) {
    const search = new RegExp(escapeRegex(filters.search), 'i');
    pipeline.push({ $match: { $or: [
      { 'user.fullName': search },
      { skills: search },
      { description: search },
      { 'location.city': search },
      { 'location.region': search },
    ] } });
  }
  if (filters.location) {
    const location = new RegExp(escapeRegex(filters.location), 'i');
    pipeline.push({ $match: { $or: [{ 'location.city': location }, { 'location.region': location }] } });
  }
  if (filters.categoryId) {
    pipeline.push({ $match: { categories: filters.categoryId } });
  }
  if (filters.verifiedOnly) {
    pipeline.push({ $match: { verificationStatus: 'verified' } });
  }
  if (filters.availability) {
    pipeline.push({ $match: { availability: filters.availability } });
  }

  pipeline.push(
    { $lookup: { from: 'servicecategories', localField: 'categories', foreignField: '_id', as: 'categoryDetails' } },
    { $lookup: {
      from: 'reviews',
      let: { workerId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$worker', '$$workerId'] }, moderationStatus: 'approved' } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
      ],
      as: 'reviewSummary',
    } },
    { $set: {
      averageRating: { $ifNull: [{ $arrayElemAt: ['$reviewSummary.average', 0] }, 0] },
      reviewCount: { $ifNull: [{ $arrayElemAt: ['$reviewSummary.count', 0] }, 0] },
    } },
  );

  if (filters.minRating > 0) pipeline.push({ $match: { averageRating: { $gte: filters.minRating } } });

  const publicFields = {
      _id: 1,
      fullName: '$user.fullName',
      categories: { $map: { input: '$categoryDetails', as: 'category', in: { name: '$$category.name', slug: '$$category.slug' } } },
      skills: 1,
      experienceYears: 1,
      description: 1,
      location: 1,
      profileImagePath: 1,
      availability: 1,
      verificationStatus: 1,
      averageRating: 1,
      reviewCount: 1,
  };
  if (workerId) {
    publicFields.phone = 1;
    publicFields.whatsapp = 1;
  }

  pipeline.push(
    { $sort: filters.sort === 'rating' ? { averageRating: -1, reviewCount: -1, updatedAt: -1 } : { updatedAt: -1, _id: 1 } },
    { $project: publicFields },
  );

  return pipeline;
}

async function findWorkers(filters) {
  let categoryId;
  if (filters.category) {
    const category = await ServiceCategory.findOne({ slug: filters.category, isActive: true }).select('_id').lean();
    if (!category) return { items: [], total: 0 };
    categoryId = category._id;
  }

  const pipeline = profilePipeline(null, { ...filters, categoryId });
  const page = filters.page || 1;
  const limit = filters.limit || 12;
  const [result = { items: [], total: 0 }] = await Worker.aggregate([
    ...pipeline,
    { $facet: {
      metadata: [{ $count: 'total' }],
      items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
    } },
    { $project: { items: 1, total: { $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0] } } },
  ]).exec();

  return result;
}

async function findPublicWorker(workerId) {
  if (!mongoose.isValidObjectId(workerId)) return null;
  const [worker] = await Worker.aggregate(profilePipeline(workerId)).exec();
  return worker || null;
}

async function findWorkerProfileForUser(userId) {
  const worker = await Worker.findOne({ user: userId })
    .populate({ path: 'categories', select: 'name slug', match: { isActive: true } })
    .exec();
  return worker;
}

async function updateWorkerProfile(userId, input) {
  const worker = await Worker.findOne({ user: userId }).exec();
  if (!worker) return null;

  if (input.categories !== undefined) {
    const categoryIds = [...new Set(input.categories)];
    const activeCategories = await ServiceCategory.find({ _id: { $in: categoryIds }, isActive: true }).select('_id').lean();
    if (activeCategories.length !== categoryIds.length) {
      const error = new Error('Choose active service categories only.');
      error.statusCode = 400;
      error.code = 'INVALID_CATEGORIES';
      throw error;
    }
    worker.categories = categoryIds;
  }

  for (const field of ['skills', 'experienceYears', 'description', 'phone', 'whatsapp', 'availability']) {
    if (input[field] !== undefined) worker[field] = input[field];
  }
  if (input.location !== undefined) {
    worker.location = {
      city: input.location.city ?? worker.location.city,
      region: input.location.region ?? worker.location.region,
    };
  }

  await worker.save();
  return findWorkerProfileForUser(userId);
}

async function updateWorkerProfileImage(userId, file) {
  const worker = await Worker.findOne({ user: userId }).exec();
  if (!worker) return null;
  const types = [
    { mime: 'image/jpeg', extension: 'jpg', valid: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    { mime: 'image/png', extension: 'png', valid: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { mime: 'image/webp', extension: 'webp', valid: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
  ];
  const type = types.find((item) => item.mime === file.mimetype && item.valid(file.buffer));
  if (!type) {
    const error = new Error('The image content did not match its file type. Upload a valid JPEG, PNG, or WebP image.');
    error.statusCode = 415;
    error.code = 'INVALID_PROFILE_IMAGE';
    throw error;
  }

  await fs.mkdir(publicProfileImageDirectory, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${type.extension}`;
  const absolutePath = path.join(publicProfileImageDirectory, fileName);
  await fs.writeFile(absolutePath, file.buffer, { flag: 'wx', mode: 0o644 });
  const previousPath = worker.profileImagePath;
  worker.profileImagePath = `/uploads/profiles/${fileName}`;
  try {
    await worker.save();
  } catch (error) {
    await fs.unlink(absolutePath).catch(() => {});
    throw error;
  }
  if (previousPath?.startsWith('/uploads/profiles/')) {
    const oldName = path.basename(previousPath);
    if (oldName === previousPath.slice('/uploads/profiles/'.length)) {
      await fs.unlink(path.join(publicProfileImageDirectory, oldName)).catch(() => {});
    }
  }
  return findWorkerProfileForUser(userId);
}

async function listApprovedReviews(workerId, page = 1, limit = 10) {
  if (!mongoose.isValidObjectId(workerId)) return null;
  const worker = await Worker.findById(workerId)
    .select('_id user')
    .populate({ path: 'user', match: { role: 'worker', accountStatus: 'active' }, select: '_id' })
    .lean()
    .exec();
  if (!worker?.user) return null;

  const [items, total] = await Promise.all([
    Review.find({ worker: workerId, moderationStatus: 'approved' })
      .select('rating body createdAt')
      .populate({ path: 'customer', select: 'fullName' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    Review.countDocuments({ worker: workerId, moderationStatus: 'approved' }),
  ]);
  return { items, total };
}

module.exports = { findPublicWorker, findWorkerProfileForUser, findWorkers, listApprovedReviews, updateWorkerProfile, updateWorkerProfileImage };

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    default: null,
  },
  reason: {
    type: String,
    enum: ['misrepresentation', 'conduct', 'spam', 'safety', 'other'],
    required: true,
  },
  details: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  status: {
    type: String,
    enum: ['open', 'reviewing', 'resolved', 'dismissed'],
    default: 'open',
    required: true,
  },
  resolutionNote: { type: String, trim: true, maxlength: 1000, default: '', select: false },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true, strict: 'throw' });

reportSchema.index({ status: 1, createdAt: 1 });
reportSchema.index({ targetUser: 1, createdAt: -1 });
reportSchema.index({ reporter: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);

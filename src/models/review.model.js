const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true,
  },
  // Set only when a review is tied to a confirmed service interaction.
  interactionKey: { type: String, trim: true, maxlength: 120, default: undefined },
  rating: { type: Number, required: true, min: 1, max: 5 },
  body: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'hidden'],
    default: 'pending',
    required: true,
  },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatedAt: { type: Date, default: null },
}, { timestamps: true, strict: 'throw' });

reviewSchema.index({ worker: 1, moderationStatus: 1, createdAt: -1 });
reviewSchema.index({ customer: 1, createdAt: -1 });
reviewSchema.index(
  { customer: 1, worker: 1, interactionKey: 1 },
  { unique: true, partialFilterExpression: { interactionKey: { $type: 'string' } } },
);

module.exports = mongoose.model('Review', reviewSchema);

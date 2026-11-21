const mongoose = require('mongoose');

const verificationDocumentSchema = new mongoose.Schema({
  storageKey: { type: String, required: true, select: false },
  contentType: { type: String, required: true, select: false },
  sizeBytes: { type: Number, required: true, min: 1, select: false },
}, { _id: false });

const verificationRequestSchema = new mongoose.Schema({
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true,
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  documents: {
    type: [verificationDocumentSchema],
    default: [],
    select: false,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    required: true,
  },
  reviewNote: { type: String, trim: true, maxlength: 1000, default: '', select: false },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true, strict: 'throw' });

verificationRequestSchema.index({ worker: 1, createdAt: -1 });
verificationRequestSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('VerificationRequest', verificationRequestSchema);

const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory',
  }],
  skills: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
  experienceYears: { type: Number, min: 0, max: 80, default: 0 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  location: {
    city: { type: String, trim: true, maxlength: 100, default: '' },
    region: { type: String, trim: true, maxlength: 100, default: '' },
  },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  whatsapp: { type: String, trim: true, maxlength: 30, default: '' },
  profileImagePath: { type: String, trim: true, maxlength: 500, default: '' },
  availability: {
    type: String,
    enum: ['available', 'unavailable'],
    default: 'available',
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'unverified',
    required: true,
  },
}, { timestamps: true, strict: 'throw' });

workerSchema.index({ verificationStatus: 1, 'location.city': 1, updatedAt: -1 });
workerSchema.index({ categories: 1, 'location.city': 1, verificationStatus: 1 });
workerSchema.index({ skills: 1 });

module.exports = mongoose.model('Worker', workerSchema);

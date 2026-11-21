const mongoose = require('mongoose');

const serviceCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  icon: { type: String, trim: true, maxlength: 60, default: '' },
  isActive: { type: Boolean, default: true, required: true },
  sortOrder: { type: Number, min: 0, default: 0 },
}, { timestamps: true, strict: 'throw' });

serviceCategorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model('ServiceCategory', serviceCategorySchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    enum: ['customer', 'worker', 'admin'],
    required: true,
    default: 'customer',
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
    required: true,
  },
}, { timestamps: true, strict: 'throw' });

userSchema.index({ role: 1, accountStatus: 1, createdAt: -1 });

module.exports = mongoose.model('User', userSchema);

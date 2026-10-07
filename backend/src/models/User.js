const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ['employee', 'employer', 'admin'], required: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  emailVerified: { type: Boolean, default: false },
  mobile: { type: String, trim: true },
  mobileVerified: { type: Boolean, default: false },
  passwordHash: { type: String, required: true, select: false },
  twoFactorEnabled: { type: Boolean, default: false },
  adminRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  mustResetPassword: { type: Boolean, default: false },
  failedLogins: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  lastIp: String,
}, { timestamps: true });

userSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: 'string' } } });

module.exports = mongoose.model('User', userSchema);

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import publicIdPlugin from './plugins/publicId.js';  // ✅ import

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ["actived", "pending", "inactive"],
    default: "inactive",  
  }
}, { timestamps: true });

UserSchema.plugin(publicIdPlugin);  // ✅ ajoute publicId

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', UserSchema);
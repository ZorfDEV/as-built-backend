import mongoose from 'mongoose';
import publicIdPlugin from './plugins/publicId.js';  // ✅ import

const SectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

SectionSchema.plugin(publicIdPlugin);  // ✅ ajoute publicId

export default mongoose.model('Section', SectionSchema);
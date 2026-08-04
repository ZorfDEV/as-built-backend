import mongoose from 'mongoose';
import publicIdPlugin from './plugins/publicId.js';  // ✅ import

const MarqueurSchema = new mongoose.Schema({
  name: { type: String, required: true },
  file: { type: String, required: true },
  description: { type: String, default: 'Nouvelle description pour le marqueur' },
}, { timestamps: true });

MarqueurSchema.plugin(publicIdPlugin);  // ✅ ajoute publicId

export default mongoose.model('Marqueur', MarqueurSchema);
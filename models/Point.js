// File: /backend/models/Point.js
import mongoose from 'mongoose';

const PointSchema = new mongoose.Schema({
  name: { type: String, required: true },
  latitude: { type: String, required: true },
  longitude: { type: String, required: true },
  description: { type: String },
  section_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  marqueur_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Marqueur', required: true },
  status: { type: String, enum: ["active", "inactive","pending","archived"], default: "inactive" },
  nature: { type: String, enum: ["pt-asbuilt", "incident","maintenance"], default: "pt-asbuilt" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  user_id:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

PointSchema.index({ latitude: 1, longitude: 1 });

export default mongoose.model('Point', PointSchema);
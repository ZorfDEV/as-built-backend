import mongoose from 'mongoose';
import publicIdPlugin from './plugins/publicId.js';  // ✅ import

const PointSchema = new mongoose.Schema({
  name: { type: String, required: true },
  latitude: { type: String, required: true },
  longitude: { type: String, required: true },
  description: { type: String },
  section_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  marqueur_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Marqueur', required: true },
  status: { 
    type: String, 
    enum: ["active", "inactive","pending","archived"], 
    default: "inactive" 
  },
  nature: { 
    type: String, 
    enum: ["gare", "incident","chambre","borne-réperage;=","CT","signalisation","pt-asbuilt"], 
    default: "pt-asbuilt" 
  },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      required: false,
    },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

PointSchema.plugin(publicIdPlugin);  // ✅ ajoute publicId

PointSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

PointSchema.index({ location: "2dsphere" });

export default mongoose.model('Point', PointSchema);
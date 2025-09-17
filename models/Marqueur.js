// File: /backend/models/Marqueur.js
import mongoose from 'mongoose';

const MarqueurSchema = new mongoose.Schema({
  name: { type: String, required: true },
  file: { type: String, required: true } // Path or URL to image
}, { timestamps: true });

export default mongoose.model('Marqueur', MarqueurSchema);

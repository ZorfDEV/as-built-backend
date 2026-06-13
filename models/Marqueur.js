// File: /backend/models/Marqueur.js
import mongoose from 'mongoose';

const MarqueurSchema = new mongoose.Schema({
  name: { type: String, required: true },
  file: { type: String, required: true } ,// Path or URL to image
  description: { type: String , default: 'Nouvelle description pour le marqueur' } ,// Nouvelle propriété pour la description
}, { timestamps: true });

export default mongoose.model('Marqueur', MarqueurSchema);

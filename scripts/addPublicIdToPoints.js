import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import Point from '../models/Point.js';

dotenv.config();

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fiberdb');
  console.log('MongoDB connecté pour migration');

  const pointsWithoutPublicId = await Point.find({ publicId: { $exists: false } });
  console.log(`${pointsWithoutPublicId.length} points à migrer`);

  for (const point of pointsWithoutPublicId) {
    point.publicId = uuidv4();
    await point.save();
  }

  console.log('✅ Migration terminée');
  process.exit(0);
};

migrate().catch(err => {
  console.error('❌ Erreur migration:', err);
  process.exit(1);
});
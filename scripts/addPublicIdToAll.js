import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import Marqueur from '../models/Marqueur.js';
import Section from '../models/Section.js';

dotenv.config();

const models = [User, Marqueur, Section];

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fiberdb');
  console.log('MongoDB connecté pour migration');

  for (const Model of models) {
    const docs = await Model.find({ publicId: { $exists: false } });
    console.log(`${Model.modelName}: ${docs.length} documents à migrer`);

    for (const doc of docs) {
      // ✅ updateOne bypasse la validation Mongoose — évite les erreurs d'enum
      await Model.updateOne(
        { _id: doc._id },
        { $set: { publicId: uuidv4() } }
      );
    }

    console.log(`✅ ${Model.modelName}: migration terminée`);
  }

  console.log('✅ Tous les modèles migrés');
  process.exit(0);
};

migrate().catch(err => {
  console.error('❌ Erreur migration:', err);
  process.exit(1);
});
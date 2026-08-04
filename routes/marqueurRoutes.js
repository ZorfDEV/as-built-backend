import express from 'express';
import { body } from 'express-validator';
import protect, { admin } from '../middleware/auth.js';
import { resolveByPublicId } from '../middleware/resolvePublicId.js';  // ✅ import
import Marqueur from '../models/Marqueur.js';  // ✅ import
import {
  getAllMarqueurs,
  createMarqueur,
  getMarqueurById,
  updateMarqueur,
  deleteMarqueur,
  deleteMultipleMarqueurs
} from './../controllers/marqueurController.js';
import upload from './../utils/uploadFile.js';

const router = express.Router();

const validateMarqueur = [
  body('name').notEmpty().withMessage('La nature est requise'),
  body('file').notEmpty().withMessage('L\'image est requise')
];

router.get('/', protect, getAllMarqueurs);
router.post('/', protect, upload.single('file'), createMarqueur);

// ✅ Modifié — :id devient :publicId avec résolution automatique
router.get('/:publicId', protect, resolveByPublicId(Marqueur), getMarqueurById);
router.put('/:publicId', protect, admin, upload.single('file'), resolveByPublicId(Marqueur), updateMarqueur);
router.delete("/deletemultiple", protect, admin, deleteMultipleMarqueurs);
router.delete('/:publicId', protect, admin, resolveByPublicId(Marqueur), deleteMarqueur);

export default router;
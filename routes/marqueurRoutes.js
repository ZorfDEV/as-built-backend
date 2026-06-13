import express from 'express';
import { body } from 'express-validator';
import protect, { admin } from '../middleware/auth.js';
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

router.get('/',protect, getAllMarqueurs);
router.post('/',protect, upload.single('file'), createMarqueur);
//router.post('/', validateMarqueur, createMarqueur);
router.get('/:id',protect, getMarqueurById);
router.put('/:id', protect,admin, upload.single('file'), updateMarqueur);
router.delete("/deletemultiple", protect, admin, deleteMultipleMarqueurs);
router.delete('/:id', protect,admin, deleteMarqueur);

export default router;

import express from 'express';
import { body } from 'express-validator';
import protect, { admin } from '../middleware/auth.js';


import {
  getAllSections,
  getSectionsWithPoints,
  createSection,
  getSectionById,
  updateSection,
  deleteSection
} from '../controllers/sectionController.js';

const router = express.Router();

const validateSection = [
  body('name').notEmpty().withMessage('Le nom est requis')
];
//route pour les sections protégées par l'authentification
router.get('/', protect, getAllSections);
router.post('/', protect, validateSection, createSection);
router.get('/:id', protect, getSectionById);
router.put('/:id',protect,admin, validateSection, updateSection);
router.delete('/:id',protect, admin, deleteSection);
router.get('/points',protect, getSectionsWithPoints);

//route pour les sections non protégées par l'authentification
/*router.get('/points', getSectionsWithPoints);
router.get('/', getAllSections);
router.post('/', validateSection, createSection);
router.get('/:id', getSectionById);
//router.put('/:id', validateSection, updateSection);
//router.delete('/:id', deleteSection);*/

export default router;
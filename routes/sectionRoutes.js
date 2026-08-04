import express from 'express';
import { body } from 'express-validator';
import protect, { admin } from '../middleware/auth.js';
import { resolveByPublicId } from '../middleware/resolvePublicId.js';  
import Section from '../models/Section.js';  

import {
  getAllSections,
  getSectionsWithPoints,
  createSection,
  getSectionById,
  updateSection,
  deleteSection,
  deleteMultipleSections
} from '../controllers/sectionController.js';

const router = express.Router();

const validateSection = [
  body('name').notEmpty().withMessage('Le nom est requis')
];

router.get('/', protect, getAllSections);
router.post('/', protect, validateSection, createSection);
router.get('/:publicId', protect, resolveByPublicId(Section), getSectionById);
router.put('/:publicId', protect, admin, validateSection, resolveByPublicId(Section), updateSection);
router.delete("/deletemultiple", protect, admin, deleteMultipleSections);
router.delete('/:publicId', protect, admin, resolveByPublicId(Section), deleteSection);
router.get('/points', protect, getSectionsWithPoints);

export default router;
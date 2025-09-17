// File: /backend/routes/index.js
import express from 'express';
import pointRoutes from './pointRoutes.js';
import sectionRoutes from './sectionRoutes.js';
import marqueurRoutes from './marqueurRoutes.js';
import upload from '../utils/uploadFile.js';
import uploadRoutes from './uploadRoutes.js';
import authRoutes from './authRoutes.js';

const router = express.Router();

router.use('/points', pointRoutes);
router.use('/sections', sectionRoutes);
router.use('/marqueurs', marqueurRoutes);
router.use('/upload', uploadRoutes);
router.use('/auth/', authRoutes);

export default router;
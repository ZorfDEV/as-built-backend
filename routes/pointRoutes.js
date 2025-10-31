import express from 'express';
import { body } from 'express-validator';
import protect, { admin }  from '../middleware/auth.js';
import {
  getAllPoints,
  getPointsBySectionPi,
  createPoint,
  createPointIncident,
  getPointById,
  updatePoint,
  deletePoint,
  getIncidentsTotal,
  getIncidentsActive,
  getIncidentsResolved,
  getIncidentPending,
  getIncidentInProgress,
  getIncidentsBySection,
  getIncidentsByUser,
  getClosestPoints,
  getPointsMap,
  deleteMultiplePoints
} from '../controllers/pointController.js';

const router = express.Router();

const validatePoint = [
  body('name').notEmpty().withMessage('Le nom est requis'),
  //body('nature').notEmpty().withMessage('La nature est requise'),
  //body('status').notEmpty().withMessage('Le statut est requis'),
  body('latitude').isFloat().withMessage('Latitude invalide'),
  body('longitude').isFloat().withMessage('Longitude invalide'),
  body('description').notEmpty().withMessage('La description est requise'),
  body('section_id').notEmpty().withMessage('Section requise'),
  body('marqueur_id').notEmpty().withMessage('Marqueur requis')
];
// route pour les points protégées par l'authentification
router.get('/', protect, getAllPoints);
router.post('/', protect, validatePoint, createPoint);
router.post('/pointsincident', protect, validatePoint, createPointIncident);
router.get('/pointsofcup', protect, getPointsBySectionPi);
router.get('/map', protect, getPointsMap);
router.get('/:id', protect, getPointById);
router.put('/:id', protect,admin, validatePoint, updatePoint);
router.delete("/deletemultiple", protect, admin, deleteMultiplePoints);
router.delete('/:id', protect,admin, deletePoint);
router.get("/incidents/total",protect, getIncidentsTotal);
router.get("/incidents/active",protect, getIncidentsActive);
router.get("/incidents/resolved",protect, getIncidentsResolved);
router.get("/incidents/pending",protect, getIncidentPending);
router.get("/incidents/inprogress",protect, getIncidentInProgress);
router.get("/incidents/section/:sectionId", protect, getIncidentsBySection);
router.get("/incidents/user/:userId", protect, getIncidentsByUser);
router.get("/closest/:incidentId", protect, getClosestPoints);


export default router;

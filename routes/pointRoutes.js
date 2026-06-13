import express from 'express';
import { body } from 'express-validator';
import protect, { admin }  from '../middleware/auth.js';
import {
  getAllPoints,
  getPointsBySectionPi,
  createPoint,
  createPointIncident,
  bulkCreatePoints,
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
import rateLimit from 'express-rate-limit'
import {  validationResult } from 'express-validator'
const router = express.Router();
const validatePoint = [
  body('name').notEmpty().withMessage('Le nom est requis'),
  //body('nature').notEmpty().withMessage('La nature est requise'),
  //body('status').notEmpty().withMessage('Le statut est requis'),
  body('latitude').isFloat().withMessage('Latitude invalide'),
  body('longitude').isFloat().withMessage('Longitude invalide'),
  body('description').notEmpty().withMessage('La description est requise'),
  body('section_id').notEmpty().withMessage('Section requise'),
  body('marqueur_id').notEmpty().withMessage('Marqueur requis'),
  body('createdAt').notEmpty().withMessage('Créé par est requis')
];
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Paramètres invalides.',
      errors: errors.array().map((e) => e.msg),
    })
  }
  next()
}
/** Limite stricte sur l'import bulk pour éviter les abus. */
const bulkRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes d\'import. Réessayez dans 15 minutes.',
  },
})

/** Limite standard pour les lectures. */
const readRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez dans une minute.',
  },
})

// ─────────────────────────────────────────────
// Règles de validation express-validator
// ─────────────────────────────────────────────

/** Valide chaque item du tableau envoyé dans le body de /bulk */
const bulkBodyRules = [
  body()
    .isArray({ min: 1, max: 1000 })
    .withMessage('Le body doit être un tableau de 1 à 1000 points.'),

  body('*.latitude')
    .notEmpty()
    .withMessage('latitude est requise.')
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude doit être un nombre entre -90 et 90.'),

  body('*.longitude')
    .notEmpty()
    .withMessage('longitude est requise.')
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude doit être un nombre entre -180 et 180.'),

  body('*.name')
    .optional()
    .isString()
    .withMessage('name doit être une chaîne.')
    .isLength({ max: 255 })
    .withMessage('name ne peut pas dépasser 255 caractères.'),

  body('*.description')
    .optional()
    .isString()
    .withMessage('description doit être une chaîne.')
    .isLength({ max: 1000 })
    .withMessage('description ne peut pas dépasser 1000 caractères.'),

  body('*.section_id')
    .optional({ nullable: true })
    .isString()
    .withMessage('section_id doit être une chaîne ou null.'),
]
// route pour les points protégées par l'authentification
router.get('/', protect, getAllPoints);
router.post('/', protect, validatePoint, createPoint);
router.post('/pointsincident', protect, validatePoint, createPointIncident);
router.post('/bulk',bulkRateLimit, bulkBodyRules,handleValidationErrors, protect, admin, bulkCreatePoints);
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

import express from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  registerUser, loginUser, logoutUser,
  updateMe, getMe,
  getAllUsers, getUserById, updateUserById,
  deleteUser, deleteMultipleUsers,
} from '../controllers/authController.js';
import protect, { admin } from '../middleware/auth.js';
import { authorizeOwner } from '../middleware/authorize.js';
import User from '../models/User.js';

const router = express.Router();

// ─── Validators ───────────────────────────────────────────────────────────────

const validateUser = [
  body('name').notEmpty().withMessage('Le nom est requis'),
  body('email').isEmail().withMessage('Adresse email invalide'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Le rôle doit être "user" ou "admin"'),
];

const validateBulkDelete = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('La liste des IDs est requise')
    .custom((ids) => ids.every((id) => typeof id === 'string' && id.length > 0))
    .withMessage('Un ou plusieurs IDs sont invalides'),
];

// ─── Rate limiters ────────────────────────────────────────────────────────────

const bulkDeleteLimiter = rateLimit({
  windowMs:       60 * 60 * 1000,
  max:            5,
  standardHeaders: true,
  legacyHeaders:  false,
  message: {
    message: 'Limite de suppressions en masse atteinte. Réessayez dans une heure.',
  },
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', protect, admin, validateUser, registerUser);

// POST /api/auth/login
router.post('/login', authLimiter, loginUser);

// POST /api/auth/logout ✅ POST au lieu de GET (bonne pratique REST)
router.post('/logout', logoutUser);

// GET /api/auth/me
router.get('/me', protect, getMe);

// PUT /api/auth/me
router.put('/me', protect, updateMe);

// ─── Users ────────────────────────────────────────────────────────────────────

// GET /api/auth/users
router.get('/users', protect, admin, getAllUsers);

// GET /api/auth/users/:id
router.get('/users/:id', protect, authorizeOwner(User), getUserById);

// PUT /api/auth/users/:id
router.put('/users/:id', protect, admin, updateUserById);

// DELETE /api/auth/me ← suppression de son propre compte
router.delete('/me', protect, authorizeOwner(User), deleteUser);

// DELETE /api/auth/deletemultiple
router.delete(
  '/deletemultiple',
  protect,
  admin,
  bulkDeleteLimiter,
  validateBulkDelete,
  deleteMultipleUsers
);

export default router;
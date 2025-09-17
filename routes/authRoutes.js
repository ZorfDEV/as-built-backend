import express from 'express';
import { body } from 'express-validator';
import { registerUser, loginUser,updateMe,getMe,getAllUsers } from '../controllers/authController.js';
import protect, { admin } from '../middleware/auth.js';

const router = express.Router();

const validateUser = [
  body('name').notEmpty().withMessage('Le nom est requis'),
  body('email').isEmail().withMessage('Adresse email invalide'),
  body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Le rôle doit être "user" ou "admin"'),
  body('avatar').optional().isURL().withMessage('L\'avatar doit être une URL valide')
];


router.get('/users', protect, getAllUsers);
router.post('/register', validateUser, registerUser);
router.post('/login', loginUser);
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Déconnexion réussie' });
});
router.get('/me', protect, getMe);
router.put('/me', protect, validateUser, updateMe);

export default router;

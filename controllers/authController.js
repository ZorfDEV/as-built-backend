import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev_secret_key';
const NODE_ENV    = process.env.NODE_ENV    || 'development';
const isProd      = NODE_ENV === 'production';

// ─── Config cookie ────────────────────────────────────────────────────────────

const COOKIE_OPTIONS = {
  httpOnly:  true,              // inaccessible depuis JS → protection XSS
  secure:    false,            // HTTPS uniquement en production
  sameSite:  isProd ? 'strict' : 'lax', // protection CSRF
  maxAge:    24 * 60 * 60 * 1000,       // 1 jour en ms
  path:      '/',
};

// ─── Helper — formate l'objet user pour les réponses ─────────────────────────

const formatUser = (user) => ({
  id:       user._id,
  publicId: user.publicId,
  name:     user.name,
  email:    user.email,
  avatar:   user.avatar,
  isActive: user.isActive,
  role:     user.role,
  status:   user.status,
});

// ─── GET /users ───────────────────────────────────────────────────────────────

export async function getAllUsers(req, res, next) {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/register ──────────────────────────────────────────────────────

export async function registerUser(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, status } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    //const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password,
      avatar:   'uploads/default-avatar.png',
      isActive: true,
      role,
      status,
    });

    const token = jwt.sign(
      {
        id:       user._id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        publicId: user.publicId,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ✅ Token dans le cookie HttpOnly
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({ user: formatUser(user) });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

export async function loginUser(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    ///Vérification du mot de passe (manquait dans l'original !)
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Mot de passe incorrect.' });
    }

    // ✅ Vérification du statut du compte
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Compte désactivé. Contactez un administrateur.' });
    }

    const token = jwt.sign(
      {
        id:       user._id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        publicId: user.publicId,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ✅ Token dans le cookie HttpOnly
    res.cookie('token', token, COOKIE_OPTIONS);

    // ✅ Plus de token dans le body — le frontend n'en a plus besoin
    res.json({ user: formatUser(user) });

  } catch (err) {
    console.error('Erreur lors de la connexion:', err);
    next(err);
  }
}

// ─── POST /auth/logout ────────────────────────────────────────────────────────

export async function logoutUser(req, res) {
  // ✅ Efface le cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path:     '/',
  });
  res.json({ message: 'Déconnexion réussie.' });
}

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

export async function getMe(req, res, next) {
  console.log("getMe - req.user:", req.user);
  
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Utilisateur non authentifié.' });
    }
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    res.json(formatUser(user));
  } catch (err) {
    next(err);
  }
}

// ─── PUT /users/me ────────────────────────────────────────────────────────────

export async function updateMe(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    if (name)   user.name   = name;
    if (email)  user.email  = email;

    await user.save();

    res.json(formatUser(user));
  } catch (err) {
    next(err);
  }
}

// ─── GET /users/:id ───────────────────────────────────────────────────────────

export async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.resourceId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    res.json(formatUser(user));
  } catch (err) {
    next(err);
  }
}

// ─── PUT /users/:id ───────────────────────────────────────────────────────────

export async function updateUserById(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findOne({ publicId: req.params.id });
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    if (user.publicId === req.user.publicId && req.body.role) {
      return res.status(400).json({
        message: 'Vous ne pouvez pas modifier votre propre rôle.',
      });
    }

    const { name, email, role, status } = req.body;
    if (name)   user.name   = name;
    if (email)  user.email  = email;
    if (role)   user.role   = role;
    if (status) user.status = status;

    await user.save();

    res.json(formatUser(user));
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /users/:id ────────────────────────────────────────────────────────

export async function deleteUser(req, res, next) {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /users (multiple) ─────────────────────────────────────────────────

export const deleteMultipleUsers = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ids } = req.body;

    if (ids.includes(req.user._id.toString())) {
      return res.status(400).json({
        message: 'Vous ne pouvez pas supprimer votre propre compte via cette action.',
      });
    }

    const existingUsers = await User.find({ publicId: { $in: ids } });

    if (existingUsers.length === 0) {
      return res.status(404).json({ message: 'Aucun utilisateur correspondant trouvé.' });
    }

    if (existingUsers.length !== ids.length) {
      return res.status(400).json({
        message: `${ids.length - existingUsers.length} ID(s) ne correspondent à aucun utilisateur.`,
      });
    }

    const totalAdminCount    = await User.countDocuments({ role: 'admin' });
    const adminsToDeleteCount = existingUsers.filter((u) => u.role === 'admin').length;

    if (totalAdminCount - adminsToDeleteCount < 1) {
      return res.status(400).json({
        message: 'Au moins un administrateur doit rester actif dans le système.',
      });
    }

    const deletedEmails = existingUsers.map((u) => u.email).join(', ');
    console.log(
      `[AUDIT] ${new Date().toISOString()} — Admin "${req.user.email}" ` +
      `a supprimé ${existingUsers.length} utilisateur(s): ${deletedEmails}`
    );

    const result = await User.deleteMany({ publicId: { $in: ids } });

    res.status(200).json({
      message:      `${result.deletedCount} utilisateur(s) supprimé(s) avec succès.`,
      deletedCount: result.deletedCount,
    });

  } catch (err) {
    console.error('[ERROR] deleteMultipleUsers:', err.message);
    res.status(500).json({
      message: 'Erreur serveur lors de la suppression.',
      error:   err.message,
    });
  }
};
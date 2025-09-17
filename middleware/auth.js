import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

export default async function protect(req, res, next) {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'vérifier vos identifiants' });
      }
      next();
    } catch (err) {
      res.status(403).json({ message: 'Session invalide' });
    }
  } else {
    res.status(402).json({ message: 'Accès non autorisé,Merci de vous connecter' });
  }
}

// Middleware pour vérifier si l'utilisateur est un administrateur
export const admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Non authentifié' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  next();
};


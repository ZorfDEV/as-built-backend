import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import e from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key'; // à mettre dans .env en prod

export async function getAllUsers(req, res, next) {
  try {
    const users = await User.find().select('-password'); // Exclure les mots de passe
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// Enregistrement d'un utilisateur
export async function registerUser(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, avatar } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      avatar,
      isActive: true, // Par défaut, l'utilisateur est actif
      role
    });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, isActive: user.isActive },
      token
    });
  } catch (err) {
    next(err);
  }
}

// Connexion d'un utilisateur
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
      console.log('Aucun utilisateur trouvé avec cet email:', email);
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    /* Utilisation de la méthode comparePassword du modèle User
    const isMatch = await user.comparePassword(password);
    console.log('Mot de passe envoyé:', password);
    console.log('Hash en base:', user.password);
    console.log('Résultat de la comparaison bcrypt:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: 'Mot de passe incorrect.' });
    }*/

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isActive: user.isActive,
        role: user.role
      },
      token
    });

  } catch (err) {
    console.error('Erreur lors de la connexion:', err);
    next(err); // Appelle le gestionnaire global des erreurs
  }
}


/*export async function loginUser(req, res, next) {
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
      return res.status(404).json( {message: 'Utilisateur non trouvé.'});
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Body reçu:', req.body);

      return res.status(401).json({ message: 'Mot de passe incorrect.', email,password });

    }

   const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {

    next(err);
    //console.error('Erreur lors de la connexion:', err);
    //res.status(500).json({ message: 'Erreur serveur' });
  }
}*/

// Obtenir les infos de l'utilisateur connecté
export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, avatar } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    user.email = email || user.email;
    user.name = name || user.name;
    user.avatar = avatar || user.avatar;

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isActive: user.isActive,
      role: user.role
    });
  } catch (err) {
    next(err);
  } 
  
}

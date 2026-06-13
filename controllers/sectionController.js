import Section from './../models/Section.js';
import { validationResult } from 'express-validator';
import Point from '../models/Point.js';
import Marqueur from '../models/Marqueur.js';

export const getAllSections = async (req, res) => {
  const sections = await Section.find().populate('user_id').sort({ createdAt: -1 });
  res.json(sections);
};
export const createSection = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    // Déstructure explicitement les champs autorisés
    const { name, description, user_id } = req.body;

    if (!name || !description || !user_id) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    const section = new Section({ name, description, user_id });
    await section.save();

    res.status(201).json(section);
  } catch (error) {
    console.error('Erreur lors de la création de la section:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};


export const getSectionsWithPoints = async (req, res) => {
  try {
    const sections = await Section.aggregate([
      {
        $lookup: {
          from: 'points',      // la collection des points
          localField: '_id',   // champ de référence dans Section
          foreignField: 'section_id', // champ de référence dans Point
          as: 'points'
        }
      },
      {
        $match: {
          'points.0': { $exists: true } // conserve uniquement sections qui ont au moins un point
        }
      },
      {
        $project: {
          points: 0 // ne renvoyer que les sections sans l’array complet de points
        }
      }
    ]);

    res.json(sections);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};


export const getSectionById = async (req, res) => {
  const sectionId = req.params.id;
  if (!sectionId) return res.status(400).json({ error: 'ID de section manquant' });
  const section = await Section.findById(sectionId);
  if (!section) return res.status(404).json({ error: 'Section introuvable' });
    const points = await Point.find({ section_id: sectionId });
  if (!points) return res.status(404).json({ error: 'Aucun point trouvé pour cette section' });
  const marqueurs = await Marqueur.find();

   res.json({ section, points, marqueurs });
};

export const updateSection = async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const updated = await Section.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

export const deleteSection = async (req, res) => {
  await Section.findByIdAndDelete(req.params.id);
  res.status(200).end();
};
export const getSectionsByUserId = async (req, res) => {
  const sections = await Section.find({ user_id: req.user.id });
  res.json(sections);
};

export const deleteMultipleSections = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Aucun ID fourni." });
    }

    const result = await Section.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Aucune section trouvée à supprimer." });
    }

    res.status(200).json({
      message: `✅ ${result.deletedCount} section(s) supprimée(s) avec succès.`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Erreur lors de la suppression multiple :", err);
    res.status(500).json({ message: "Erreur serveur.", error: err.message });
  }
};


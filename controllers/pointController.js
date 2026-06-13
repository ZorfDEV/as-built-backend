import Point from '../models/Point.js';
import { validationResult } from 'express-validator';
import  XLSX from 'xlsx';
import Section from '../models/Section.js';
//import { Request, Response } from "express";

const MAX_BULK_SIZE = 1000 // Limite max de points par import

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

/**
 * Vérifie qu'une valeur est un nombre fini dans un intervalle donné.
 */
function isFiniteInRange(value, min, max) {
  const n = Number(value)
  return isFinite(n) && n >= min && n <= max
}

/**
 * Valide un point individuel.
 * Retourne un tableau de messages d'erreur (vide = valide).
 * @param {unknown} point
 * @param {number} index
 * @returns {string[]}
 */
function validatePoint(point, index) {
  const errs = []
  const prefix = `Point[${index}]`

  if (!point || typeof point !== 'object') {
    return [`${prefix} : valeur non-objet reçue`]
  }

  const { latitude, longitude, name } = point

  if (!isFiniteInRange(latitude, -90, 90)) {
    errs.push(`${prefix} : latitude invalide (reçu: ${latitude})`)
  }

  if (!isFiniteInRange(longitude, -180, 180)) {
    errs.push(`${prefix} : longitude invalide (reçu: ${longitude})`)
  }

  // Reject null island (0,0) — souvent un champ vide mal parsé
  if (Number(latitude) === 0 && Number(longitude) === 0) {
    errs.push(`${prefix} : coordonnées (0, 0) rejetées — probablement vides`)
  }

  if (name !== undefined && typeof name !== 'string') {
    errs.push(`${prefix} : name doit être une chaîne de caractères`)
  }

  return errs
}

/**
 * Sanitise et normalise un point valide avant insertion en base.
 * @param {object} point
 * @returns {object}
 */
function sanitizePoint(point) {
  return {
    name: typeof point.name === 'string' ? point.name.trim().slice(0, 255) : '',
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
    section_id: point.section_id ?? null,
    description:
      typeof point.description === 'string'
        ? point.description.trim().slice(0, 1000)
        : '',
        marqueur_id: point.marqueur_id ?? null,
    status: point.status === 'active' ? 'active' : 'inactive',
    nature: point.nature === 'incident' ? 'incident' : 'pt-asbuilt',
      location: {
        type: 'Point',
        coordinates: [Number(point.longitude), Number(point.latitude)],
      },
      user_id: point.user_id ?? null,

  }
}


// Générateur d'ID unique alphanumérique
const generateId = (length = 5) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const createPointIncident = async (req, res) => {
  try {
    const {name, section_id, latitude, longitude, description, user_id, marqueur_id } = req.body;

    // Récupérer la section
    const section = await Section.findById(section_id);
    if (!section) return res.status(404).json({ message: section_id ? "Section not found" : "Section ID is required" });

    // Construire le nom du point
    //const uniqueId = generateId(5);
    //const pointName = `pi-${section.name}-${uniqueId}`;
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    const newPoint = new Point({
      name,
      section_id,
      marqueur_id,
      latitude,
      longitude,
      description,
      status: 'active',
      nature: 'incident',
      user_id,
      location: {
        type: 'Point',
        coordinates: [lonNum, latNum], 
      },

    });
    await newPoint.save();
    res.status(201).json(newPoint);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la création du point" });
  }
};


export const getAllPoints = async (req, res) => {

  //const ptasbuilt = 'pt-asbuilt';
  const points = await Point.find({ nature: { $ne: "incident" } }).populate('section_id').populate('marqueur_id').sort({ createdAt: -1 });
  const marqueurs = points.map(p => p.marqueur_id).filter(Boolean);
  const sections = points.map(p => p.section_id).filter(Boolean);
  res.json(points, marqueurs , sections);
};

export const getPointsMap = async (req, res) => {
  try {
    const points = await Point.find({ nature: { $ne: "incident" } }).populate('section_id').populate('marqueur_id').sort({ createdAt: -1 });
    const marqueurs = points.map(p => p.marqueur_id).filter(Boolean);
  const sections = points.map(p => p.section_id).filter(Boolean);
    res.json(points, marqueurs, sections );
  } catch (err) {
    res.status(500).json({ success: false, message: "Erreur serveur", error: err.message });
  }
};


// Récupérer les points de nature 'incident'
export const getPointsBySectionPi = async (req, res) => {
  const ptnature = 'incident'; //req.params.sectionId;
  if (!ptnature) {
    return res.status(400).json({ message: 'Section ID is required' });
  }
  const points = await Point.find({ nature: ptnature }).populate('section_id').populate('marqueur_id').sort({ createdAt: -1 });
  res.json(points);
};

// Create a point As-built

export const createPoint = async (req, res) => {
  try {
   /* const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }*/
    const {
      name,
      longitude,
      latitude,
      description,
      nature,
      section_id,
      marqueur_id,
      status,
      user_id,
    } = req.body;
 const latNum = parseFloat(latitude);
const lonNum = parseFloat(longitude);

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({ message: "Coordonnées invalides" });
    }

    if (!req.user) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    // ✅ Création sécurisée (whitelist)
    const point = new Point({
      name,
      longitude,
      latitude,
      description,
      nature,
      section_id,
      marqueur_id,
      status: status || "inactive",
      user_id,
      location: {
        type: 'Point',
        coordinates: [lonNum, latNum], 
      },
    });

    await point.save();

    return res.status(201).json({
      message: "Point créé avec succès",
      data: point,
    });

  } catch (error) {
    console.error("CREATE POINT ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur lors de la création du point",
    });
  }
};

const convertDMS = (dmsString) => {
    if (!dmsString) return null;
    const regex = /([NSWE]):(\d{1,3})[°:\s](\d{1,2})[′:\s](\d{1,2}(\.\d+)?)[″]?/gi;
    const matches = [...dmsString.matchAll(regex)];
    let lat = null, lng = null;

    for (const match of matches) {
      const [, dir, deg, min, sec] = match;
      const decimal = parseInt(deg) + parseInt(min) / 60 + parseFloat(sec) / 3600;
      if (dir === 'S') lat = -decimal;
      else if (dir === 'N') lat = decimal;
      else if (dir === 'W') lng = -decimal;
      else if (dir === 'E') lng = decimal;
    }

    return { lat, lng };
  };

// Créer un point à partir des coordonnées DMS dans un fichier Excel
export const bulkCreatePoints = async (req, res) => {
   const { body } = req

  // 1. Vérification de type du payload
  if (!Array.isArray(body)) {
    return res.status(400).json({
      success: false,
      message: 'Le corps de la requête doit être un tableau JSON.',
    })
  }

  if (body.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Le tableau est vide, aucun point à importer.',
    })
  }

  if (body.length > MAX_BULK_SIZE) {
    return res.status(400).json({
      success: false,
      message: `Trop de points : maximum ${MAX_BULK_SIZE} par import (reçu: ${body.length}).`,
    })
  }

  // 2. Validation de chaque point
  const allErrors = []

  body.forEach((point, i) => {
    const errs = validatePoint(point, i + 1)
    allErrors.push(...errs)
  })

  if (allErrors.length > 0) {
    return res.status(422).json({
      success: false,
      message: `${allErrors.length} erreur(s) de validation détectée(s).`,
      errors: allErrors,
    })
  }

  // 3. Sanitisation
  const sanitized = body.map(sanitizePoint)

  // 4. Insertion en base
  try {

      const result = await Point.insertMany(sanitized);
    
      return res.status(201).json({
      success: true,
      message: `${result.length} point(s) importé(s) avec succès.`,
      count: result.length,
    });
    } catch (err) {
    console.error('[bulkCreatePoints] Erreur DB :', err)

    // Distinguer les erreurs de contrainte DB des erreurs inattendues
    if (err.code === '23505') {
      // PostgreSQL unique_violation
      return res.status(409).json({
        success: false,
        message: 'Conflit : certains points existent déjà en base.',
      })
    }

    return res.status(500).json({
      success: false,
      message: 'Erreur interne lors de l\'insertion en base de données.',
    })
  }
  
}

// Récupérer un point par ID

export const getPointById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "ID manquant" });
    }

    const point = await Point.findById(id)
      .populate("section_id")
      .populate("marqueur_id");

    if (!point) {
      return res.status(404).json({ message: "Point non trouvé" });
    }

    res.status(200).json(point);
  } catch (error) {
    console.error("Erreur getPointById:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Update point ID

export const updatePoint = async (req, res) => {
 // const errors = validationResult(req);
  //if (!errors.isEmpty()) return res.status(402).json({ errors: errors.array() });
  if (!req.params.id) return res.status(400).json({ message: "ID manquant" });
  const updated = await Point.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

// Delete point by ID

export const deletePoint = async (req, res) => {
  await Point.findByIdAndDelete(req.params.id);
  res.status(204).end();
};



export const getIncidentsTotal = async (req, res) => {
  try {
    const ptnature = "incident";
    const total = await Point.countDocuments({ nature: ptnature });
   const totalgeneral = await Point.countDocuments({ nature: ptnature });
    const percentage = totalgeneral > 0 ? ((total / totalgeneral) * 100).toFixed(2) : "0.00";
    res.json({ total, percentage });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentsActive = async (req, res) => {
  try {
    const ptnature = "incident";
    const status = "active";
    const total= await Point.countDocuments({ nature: ptnature, status: status });
    const totalgeneral = await Point.countDocuments({ nature: ptnature });
    const percentage = totalgeneral > 0 ? ((total / totalgeneral) * 100).toFixed(2) : "0.00";

    res.json({ total, status, percentage });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentsResolved = async (req, res) => {
  try {
    const ptnature = "incident";
    const status = "archived";
    const total = await Point.countDocuments({ nature: ptnature, status: status });
    const totalgeneral = await Point.countDocuments({ nature: ptnature });
    const percentage = totalgeneral > 0 ? ((total / totalgeneral) * 100).toFixed(2) : "0.00";
    res.json({ total, status, percentage });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentPending = async (req, res) => {
  try {
    const ptnature = "incident";
    const status = "pending";
    const total = await Point.countDocuments({ nature: ptnature, status: status });
    const totalgeneral = await Point.countDocuments({ nature: ptnature });
    const percentage = totalgeneral > 0 ? ((total / totalgeneral) * 100).toFixed(2) : "0.00";

    res.json({ total, status, percentage });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentInProgress = async (req, res) => {
  try {
    const ptnature = "incident";
    const status = "in progress";
    const total = await Point.countDocuments({ nature: ptnature, status: status });
    const totalgeneral = await Point.countDocuments({ nature: ptnature });
    const percentage = totalgeneral > 0 ? ((total / totalgeneral) * 100).toFixed(2) : "0.00";
    res.json({ total, status, percentage });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};


export const getIncidentsBySection = async (req, res) => {
  try {
    const ptnature = "incident";
    const sectionId = req.params.sectionId;
    const incidents = await Point.find({ nature: ptnature, section_id: sectionId });

    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentsByUser = async (req, res) => {
  try {
    const ptnature = "incident";
    const userId = req.params.userId;
    const incidents = await Point.find({ nature: ptnature, user_id: userId });

    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export const getClosestPoints = async (req, res) => {
  try {
    const { incidentId } = req.params;
    const incident = await Point.findById(incidentId);

    // Vérifications de base
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: "Incident non trouvé.",
        points: [],
        count: 0
      });
    }

    if (!incident.location?.coordinates) {
      return res.status(400).json({
        success: false,
        message: "Ce point incident n’a pas de coordonnées géospatiales.",
        points: [],
        count: 0
      });
    }

    const [lon, lat] = incident.location.coordinates;

    // Requête des points les plus proches (exclut l’incident)
    const points = await Point.find({
      _id: { $ne: incidentId },
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lon, lat] },
          $maxDistance: 5000 // 5 km
        }
      }
    }).limit(10);
    return res.status(200).json({
      success: true,
      message:
        points.length === 0
          ? "PI isolé dans un rayon de 5 km."
          : `${points.length} point(s) approximité(s) du PI dans un rayon de 5 km.`,
      points,
      count: points.length,
      incident: {
        id: incident._id,
        name: incident.name,
        coordinates: incident.location.coordinates
      }
    });
  } catch (err) {
    console.error("Erreur dans getClosestPoints:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des points.",
      error: err.message,
      points: [],
      count: 0
    });
  }
};


// suppression en masse des points
export const deleteMultiplePoints = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Aucun ID fourni." });
    }

    const result = await Point.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Aucun point trouvé à supprimer." });
    }

    res.status(200).json({
      message: `✅ ${result.deletedCount} point(s) supprimé(s) avec succès.`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Erreur lors de la suppression multiple :", err);
    res.status(500).json({ message: "Erreur serveur.", error: err.message });
  }
};


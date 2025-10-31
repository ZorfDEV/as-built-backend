import Point from '../models/Point.js';
import { validationResult } from 'express-validator';
import  XLSX from 'xlsx';
import Section from '../models/Section.js';

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
        coordinates: [lonNum, latNum], // IMPORTANT: [longitude, latitude]
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
  const points = await Point.find().populate('section_id').populate('marqueur_id').sort({ createdAt: -1 });
  const marqueurs = points.map(p => p.marqueur_id).filter(Boolean);
  const sections = points.map(p => p.section_id).filter(Boolean);
  res.json(points, marqueurs , sections);
};

export const getPointsMap = async (req, res) => {
  try {
    const points = await Point.find({ status: { $ne: "archived" } }).populate('section_id').populate('marqueur_id').sort({ createdAt: -1 });
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

export const createPoint = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const point = new Point(req.body);
  await point.save();
  res.status(201).json(point);
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
export const createPointFromDMS = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  try {
    const filePath = req.file.path;
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];  
      const rows = XLSX.utils.sheet_to_json(sheet);
      //const { lat, lng } = convertDMS(req.body.dms);
      if (!rows || rows.length === 0) {
        return res.status(400).json({ message: 'No data found in the file' });
      }
      // Validate that required fields are present in the rows
      const requiredFields = ['name', 'latitude', 'longitude', 'description', 'section_id', 'marqueur_id', 'user_id',
        'status', 'nature'
      ];
      for (const row of rows) { 
        for (const field of requiredFields) {
          if (!row[field]) {
            return res.status(400).json({ message: `Missing required field: ${field}` });
          }
        }
      }
 const validated= rows.map((row) => {
      let lat = row.latitude ? row.latitude.trim() : '';
      let lng = row.longitude ? row.longitude.trim() : '';

      // Si ce n'est pas un nombre, on tente la conversion DMS
      if (isNaN(lat) || isNaN(lng)) {
        const converted = convertDMS(`${lat}, ${lng}`);
       // console.log('Coordonnées converties:', converted);
        if (!converted || isNaN(converted.lat) || isNaN(converted.lng)) return null;
        lat = converted.lat;
        lng = converted.lng;
      }
      if (isNaN(lat) || isNaN(lng)) {
        console.error('Coordonnées invalides pour la ligne:', row);
        return null;
  }
      return {
        name: row.name,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        description: row.description || '',
        section_id: row.section_id,
        marqueur_id: row.marqueur_id,
        status: row.status || 'inactive',
        nature: row.nature || 'pt-asbuilt',
        user_id: row.user_id,
      };
})
if (validated.length === 0) {
          console.error('Aucune ligne valide trouvée dans le fichier');
          return res.status(400).json({ message: 'Aucune ligne valide trouvée dans le fichier' })
    }
      // Filtrer les lignes valides
      const validRows = validated.filter(row => row !== null);    
      if (validRows.length === 0) {
        console.error('Aucune ligne valide trouvée dans le fichier');
        return res.status(400).json({ message: 'Aucune ligne valide trouvée dans le fichier' });
      }
      // Insérer les points valides dans la base de données
      const latNum = validRows[0].latitude;
      const lonNum = validRows[0].longitude;

      const points = await Point.insertMany(validRows.map(row => ({
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        description: row.description,
        section_id: row.section_id,
        marqueur_id: row.marqueur_id,
        status: row.status || 'inactive',
        nature: row.nature || 'pt-asbuilt',
        user_id: row.user_id,
        location: {
          type: 'Point',
          coordinates: [row.longitude, row.latitude],
      },
      })));
    
      res.status(201).json(points);
    } catch (error) {
      console.error('Error processing Excel file:', error);
      res.status(500).json({ message: 'Error processing Excel file' });
    }
  
}


export const getPointById = async (req, res) => {
  const point = await Point.findById(req.params.id).populate('section_id').populate('marqueur_id');
  if (!point) return res.status(404).json({ error: 'Point not found' });
  res.json(point);
};

export const updatePoint = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const updated = await Point.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

export const deletePoint = async (req, res) => {
  await Point.findByIdAndDelete(req.params.id);
  res.status(204).end();
};

export const getIncidentsTotal = async (req, res) => {
  try {
    const ptnature = "incident";
    const total = await Point.countDocuments({ nature: ptnature });

    res.json({ total });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentsActive = async (req, res) => {
  try {
    const ptnature = "incident";
    const status = "active";
    const total = await Point.countDocuments({ nature: ptnature, status: status });

    res.json({ total, status });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentsResolved = async (req, res) => {
  try {
    const ptnature = "incident";
    const status = "archived";
    const total = await Point.countDocuments({ nature: ptnature, status: status });

    res.json({ total, status });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentPending = async (req, res) => {
  try {
    const ptnature = "incident";
    const status = "pending";
    const total = await Point.countDocuments({ nature: ptnature, status: status });

    res.json({ total, status });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
export const getIncidentInProgress = async (req, res) => {
  try {
    const ptnature = "incident";
    const status = "in progress";
    const total = await Point.countDocuments({ nature: ptnature, status: status });

    res.json({ total, status });
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

    // Réponse cohérente (même structure dans tous les cas)
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


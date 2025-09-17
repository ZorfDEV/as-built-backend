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
      const requiredFields = ['name', 'latitude', 'longitude', 'description', 'section_id', 'marqueur_id'];
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
        marqueur_id: row.marqueur_id
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
      const points = await Point.insertMany(validRows.map(row => ({
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        description: row.description,
        section_id: row.section_id,
        marqueur_id: row.marqueur_id
      })));
    /*  const points = await Point.insertMany(rows.map(row => ({  
        
        name: row.name,
        latitude:lat,
        longitude:lng,
        description: row.description,
        section_id: row.section_id,
        marqueur_id: row.marqueur_id
      })));*/
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
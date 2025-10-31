import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import JSZip from 'jszip';
import xml2js from 'xml2js';
import Point from '../models/Point.js';
import protect  from '../middleware/auth.js';
import { createPointFromDMS } from '../controllers/pointController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/filePoints' });

router.post('/xlsx', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  try {
    await createPointFromDMS(req, res);
  } catch (error) {
    console.error('Error processing Excel file:', error);
    res.status(500).json({ message: 'Error processing Excel file' });
  }
});

router.post('/kmz', protect, upload.single('file'), async (req, res) => {
  const zip = await JSZip.loadAsync(req.file.buffer || fs.readFileSync(req.file.path));
  const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
  const kmlText = await zip.files[kmlFile].async('string');
  const kml = await xml2js.parseStringPromise(kmlText);

  const placemarks = kml.kml.Document[0].Placemark || [];
  const points = placemarks.map(p => {
    const coords = p.Point?.[0]?.coordinates?.[0].split(',') || [];
    return {
      name: p.name?.[0],
      latitude: parseFloat(coords[1]),
      longitude: parseFloat(coords[0]),
      description: p.description?.[0] || '',
      nature: 'kmz',
      section_id: req.body.section_id,
      marqueur_id: req.body.marqueur_id
    };
  });

  const inserted = await Point.insertMany(points);
  res.status(201).json(inserted);
});
router.post('/shp', protect, upload.single('file'), async (req, res) => {
  // Handle SHP file upload and processing
  // This is a placeholder for SHP file handling
  res.status(501).json({ message: 'SHP file handling not implemented yet' });
});
router.post('/geojson', protect, upload.single('file'), async (req, res) => {
  // Handle GeoJSON file upload and processing
  // This is a placeholder for GeoJSON file handling
  res.status(501).json({ message: 'GeoJSON file handling not implemented yet' });
});
router.post('/gpx', protect, upload.single('file'), async (req, res) => {
  // Handle GPX file upload and processing
  // This is a placeholder for GPX file handling
  res.status(501).json({ message: 'GPX file handling not implemented yet' });
});
router.post('/kml', protect, upload.single('file'), async (req, res) => {
  // Handle KML file upload and processing
  // This is a placeholder for KML file handling
  res.status(501).json({ message: 'KML file handling not implemented yet' });
});
router.post('/csv', protect, upload.single('file'), async (req, res) => {
  const workbook = xlsx.readFile(req.file.path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  const points = await Point.insertMany(rows.map(row => ({
    nom: row.nom,
    latitude: row.latitude,
    longitude: row.longitude,
    nature: row.nature,
    description: row.description,
    section_id: row.section_id,
    marqueur_id: row.marqueur_id
  })));
  res.status(201).json(points);
});
router.get('/nearest', protect, async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ message: 'Latitude and longitude are required' });

  const allPoints = await Point.find();
  const from = turf.point([parseFloat(lng), parseFloat(lat)]);

  let nearest = null;
  let minDistance = Infinity;

  allPoints.forEach(p => {
    const to = turf.point([p.longitude, p.latitude]);
    const distance = turf.distance(from, to, { units: 'kilometers' });
    if (distance < minDistance) {
      minDistance = distance;
      nearest = { point: p, distance };
    }
  });

  if (!nearest) return res.status(404).json({ message: 'No points found' });
  res.json(nearest);
});
export default router;        
// File: routes/uploadRoutes.js
import express from 'express'
import multer from 'multer'
import XLSX from 'xlsx'
import path from 'path'
import Point from '../models/Point.js'

const router = express.Router()

// -------------------- DMS CONVERSION --------------------
function convertDMS(dmsString) {
  if (!dmsString) return null

  const regex = /([NSWE]):(\d{1,3})[°:\s](\d{1,2})[′:\s](\d{1,2}(\.\d+)?)[″]?/gi
  const matches = [...dmsString.matchAll(regex)]

  let lat = null
  let lng = null

  for (const match of matches) {
    const [, dir, deg, min, sec] = match
    const decimal =
      parseInt(deg) + parseInt(min) / 60 + parseFloat(sec) / 3600

    if (dir === 'S') lat = -decimal
    else if (dir === 'N') lat = decimal
    else if (dir === 'W') lng = -decimal
    else if (dir === 'E') lng = decimal
  }

  return { lat, lng }
}

// -------------------- MULTER CONFIG --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/filePoints')
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true)
    } else {
      cb(new Error('Seuls les fichiers Excel sont autorisés'))
    }
  }
})

// -------------------- ROUTE --------------------
router.post('/xlsx', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' })
  }

  try {
    const filePath = req.file.path

    const workbook = XLSX.readFile(filePath)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: 'Fichier vide' })
    }

    const validRows = []
    const errors = []

    rows.forEach((row, index) => {
      let rawLat = row.latitude
      let rawLng = row.longitude

      let lat = Number(rawLat)
      let lng = Number(rawLng)

      // Try DMS conversion if needed
      if (isNaN(lat) || isNaN(lng)) {
        const converted = convertDMS(`${rawLat}, ${rawLng}`)

        if (converted) {
          lat = converted.lat
          lng = converted.lng
        }
      }

      // Final validation
      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        isNaN(lat) ||
        isNaN(lng)
      ) {
        errors.push(`Ligne ${index + 1}: coordonnées invalides`)
        console.log('TOTAL LIGNES:', rows.length)
        console.log('VALIDES:', validRows.length)
        console.log('ERREURS:', errors.length)
        return
      }

      validRows.push({
        name: row.name,
        latitude: lat,
        longitude: lng,
        description: row.description || '',
        section_id: row.section_id,
        marqueur_id: row.marqueur_id,
        status: row.status || 'inactive',
        nature: row.nature || 'pt-asbuilt',
        user_id: row.user_id,
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      })
    })

    if (validRows.length === 0) {
      return res.status(400).json({
        message: 'Aucune ligne valide',
        errors
      })
    }

    const inserted = await Point.insertMany(validRows)

    res.status(201).json({
      count: inserted.length,
      errors
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erreur traitement fichier' })
  }
})

export default router

import multer from 'multer';
import path from 'path';

// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/ic-markers'); // Répertoire cible
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Filtrage des fichiers SVG
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers SVG sont autorisés.'), false);
  }
};

// Création du middleware Multer
const upload = multer({ storage, fileFilter });

export default upload;

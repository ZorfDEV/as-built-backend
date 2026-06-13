import Marqueur from './../models/Marqueur.js';


export const getAllMarqueurs = async (req, res) => {
  const marqueurs = await Marqueur.find().sort({ createdAt: -1 });
  res.json(marqueurs);
};

export const createMarqueur = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Vérifie qu'un fichier a été uploadé
    if (!req.file) {
      return res.status(400).json({ message: 'Fichier SVG requis.' });
    }

    // Crée le chemin relatif vers le fichier
    const filePath = `/uploads/ic-markers/${req.file.filename}`;

    // Crée un nouveau Marqueur
    const marqueur = new Marqueur({
      name: name,
      file: filePath,
      description: description || '' // Ajoute la description si elle est fournie
    });

    // Enregistre dans la base
    await marqueur.save();

    res.status(201).json(marqueur);
  } catch (err) {
    console.error('Erreur création marqueur :', err);
    res.status(500).json({ message: 'Erreur serveur lors de la création du marqueur.' });
  }
};


export const getMarqueurById = async (req, res) => {
  const marqueur = await Marqueur.findById(req.params.id);
  res.json(marqueur);
};

export const updateMarqueur = async (req, res) => {
  const updated = await Marqueur.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

export const deleteMarqueur = async (req, res) => {
  await Marqueur.findByIdAndDelete(req.params.id);
  res.status(204).end();
};
export const deleteMultipleMarqueurs = async (req, res) => {
  const { ids } = req.body; // Attendre un tableau d'IDs dans le corps de la requête

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "Aucun ID fourni." });
  }

  const result = await Marqueur.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Aucun marqueur trouvé à supprimer." });
  }

  res.status(200).json({
    message: `✅ ${result.deletedCount} marqueur(s) supprimé(s) avec succès.`,
    deletedCount: result.deletedCount,
  });
};
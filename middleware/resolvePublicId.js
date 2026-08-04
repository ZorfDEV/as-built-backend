export const resolveByPublicId = (Model) => async (req, res, next) => {
  try {
    const doc = await Model.findOne({ publicId: req.params.publicId });
    
    if (!doc) {
      return res.status(404).json({ message: 'Ressource non trouvée.' });
    }

    req.resource = doc;
    req.resourceId = doc._id;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
};
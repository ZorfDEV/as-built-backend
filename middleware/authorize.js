// ── Vérifie que l'utilisateur accède uniquement à ses propres ressources ──
export const authorizeOwner = (Model, field = '_id') => async (req, res, next) => {
  try {
    // ✅ Cherche par publicId au lieu de l'ObjectId MongoDB
    const resource = await Model.findOne({ publicId: req.params.id });

    if (!resource) {
      return res.status(404).json({ message: 'Ressource non trouvée.' });
    }

    // Admin peut tout voir
    if (req.user.role === 'admin') {
      req.resource = resource;
      req.resourceId = resource._id; 
      return next();
    }

    // User normal — vérifie qu'il accède à ses propres données
    if (resource[field].toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    req.resource = resource;
    req.resourceId = resource._id; 
    next();
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
};
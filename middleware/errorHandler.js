export default function errorHandler(err, req, res, next) {
  console.error('Global Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Une erreur est survenue côté serveur.'
  });
}
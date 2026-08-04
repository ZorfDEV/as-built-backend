import rateLimit from 'express-rate-limit';

// ── Limiteur pour le login ──────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 10,                   
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

// ── Limiteur général pour toutes les routes API ─────────
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,      
  max: 100,                  
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes. Réessayez dans un instant.' }
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,                    
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Limite d\'upload atteinte. Réessayez dans une heure.' }
});
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const isProd = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET && isProd) {
  throw new Error("JWT_SECRET est obligatoire en production.");
}

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   false,        // ✅ false en dev (HTTP)
  sameSite: "lax",        // ✅ lax en dev
  maxAge:   24 * 60 * 60 * 1000, // 1 jour
  path:     "/",          // ✅ disponible sur toutes les routes
};

export default async function protect(req, res, next) {
  try {
    // ============================
    // Lecture du cookie
    // ============================
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({
        message: "Veuillez vous connecter.",
      });
    }

    // ============================
    // Vérification du JWT
    // ============================
    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      res.clearCookie("token", COOKIE_OPTIONS);

      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Votre session a expiré.",
        });
      }

      return res.status(401).json({
        message: "Session invalide.",
      });
    }

    // ============================
    // Vérifie le contenu du token
    // ============================
    if (!decoded?.id) {
      res.clearCookie("token", COOKIE_OPTIONS);

      return res.status(401).json({
        message: "Token invalide.",
      });
    }

    // ============================
    // Recherche utilisateur
    // ============================
    const user = await User.findById(decoded.id)
      .select("-password")
      .lean();
    // console.log("Utilisateur trouvé :", user);

    if (!user) {
      res.clearCookie("token", COOKIE_OPTIONS);

      return res.status(401).json({
        message: "Utilisateur introuvable.",
      });
    }

    // ============================
    // Compte désactivé
    // ============================
    if (user.isActive === false) {
      res.clearCookie("token", COOKIE_OPTIONS);

      return res.status(403).json({
        message: "Compte désactivé.",
      });
    }

  //console.log("Decoded :", decoded);
    req.user = user;

    next();
  } catch (error) {
    console.error("AUTH ERROR:", error);

    res.clearCookie("token", COOKIE_OPTIONS);

    return res.status(500).json({
      message: "Erreur interne d'authentification.",
    });
  }
}

/**
 * Middleware Admin
 */
export const admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Non authentifié.",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Accès refusé. Rôle administrateur requis.",
    });
  }

  next();
};

/**
 * Middleware de rôles
 */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Non authentifié.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Accès refusé. Rôle requis : ${roles.join(" ou ")}.`,
      });
    }

    next();
  };
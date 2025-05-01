/**
 * Middleware d'authentification
 * Vérifie si l'utilisateur est connecté avant d'accéder aux routes protégées
 */

/**
 * Vérifie si l'utilisateur est authentifié via sa session
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction de passage au middleware suivant
 */
export const authMiddleware = (req, res, next) => {
    if (req.session && req.session.user) {
      next();
    } else {
      res.status(401).json({ success: false, message: "Non authentifié" });
    }
  };
  
  export default authMiddleware;
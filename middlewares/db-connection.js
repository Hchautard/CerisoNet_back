/**
 * Middleware de vérification de connexion à MongoDB
 * Vérifie si la connexion à MongoDB est établie avant de traiter la requête
 */

import { isConnected, connectToMongoDB } from '../services/mongo.js';

/**
 * Vérifie la connexion à MongoDB et tente de se reconnecter si nécessaire
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction de passage au middleware suivant
 */
export const checkMongoConnection = async (req, res, next) => {
  if (!isConnected()) {
    try {
      const connected = await connectToMongoDB();
      if (!connected) {
        return res.status(500).json({
          success: false,
          message: "Erreur de connexion à la base de données MongoDB"
        });
      }
    } catch (error) {
      console.error("Erreur lors de la connexion à MongoDB:", error);
      return res.status(500).json({
        success: false,
        message: "Erreur de connexion à la base de données MongoDB"
      });
    }
  }
  next();
};

export default checkMongoConnection;
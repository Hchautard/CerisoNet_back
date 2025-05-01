/**
 * Routes pour la gestion des utilisateurs
 * Récupération des informations utilisateur et des utilisateurs connectés
 */

import express from 'express';
import authMiddleware from '../middlewares/auth.js';
import { getConnectedUsers } from '../services/postgres.js';

const router = express.Router();

/**
 * Route pour récupérer les informations de l'utilisateur connecté
 * GET /user
 */
router.get('/user', authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.session.user
  });
});

/**
 * Route pour récupérer les utilisateurs connectés
 * GET /users/connected
 */
router.get('/users/connected', authMiddleware, async (req, res) => {
  try {
    // Récupérer les utilisateurs avec statut_connexion = 1
    const connectedUsers = await getConnectedUsers();
    
    res.status(200).json({
      success: true,
      connectedUsers
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs connectés:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des utilisateurs connectés"
    });
  }
});

export default router;
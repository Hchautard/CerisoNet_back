/**
 * Routes d'authentification
 * Gestion de la connexion et déconnexion des utilisateurs
 */

import express from 'express';
import crypto from 'crypto';
import { getPostgresPool, updateUserConnectionStatus } from '../services/postgres.js';

const router = express.Router();

/**
 * Route de connexion (login)
 * Vérifie les identifiants utilisateur contre la base PostgreSQL
 * POST /login
 */
router.post('/login', async (req, res) => {
  try {
    // Récupération des identifiants
    const { email, password } = req.body;
    
    // Validation des entrées
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email et mot de passe requis"
      });
    }

    // Connexion à PostgreSQL
    const pgPool = await getPostgresPool();

    // Recherche de l'utilisateur dans la base PostgreSQL
    const result = await pgPool.query(
      'SELECT * FROM fredouil.compte WHERE mail = $1',
      [email]
    );

    const user = result.rows[0];
    
    // Vérification de l'existence de l'utilisateur et du mot de passe
    // Le mot de passe est stocké en SHA1 dans la base
    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
    
    if (!user || user.motpasse !== hashedPassword) {
      return res.status(401).json({
        success: false,
        message: !user ? "Utilisateur non trouvé" : "Mot de passe incorrect"
      });
    }

    // Mise à jour du statut de connexion à 1 (connecté)
    await updateUserConnectionStatus(user.id, 1);

    // Création de la session utilisateur
    req.session.user = {
      id: user.id,
      mail: user.mail,
      nom: user.nom,
      prenom: user.prenom,
      lastLogin: new Date().toISOString()
    };

    // Envoi des informations utilisateur au client
    res.status(200).json({
      success: true,
      message: "Connexion réussie",
      user: {
        id: user.id,
        mail: user.mail,
        nom: user.nom,
        prenom: user.prenom,
        lastLogin: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    
    // Gestion des différentes erreurs possibles
    if (error.code === 'ECONNREFUSED') {
      return res.status(500).json({
        success: false,
        message: "Erreur de connexion à la base de données"
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la connexion"
      });
    }
  }
});

/**
 * Route de déconnexion (logout)
 * Détruit la session et efface le cookie
 * POST /logout
 */
router.post('/logout', async (req, res) => {
  try {
    // Récupérer l'ID de l'utilisateur avant de détruire la session
    const userId = req.session.user ? req.session.user.id : null;
    
    if (userId) {
      // Mise à jour du statut de connexion à 0 (déconnecté)
      await updateUserConnectionStatus(userId, 0);
    }
    
    // Détruire la session
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Erreur lors de la déconnexion"
        });
      }
      
      // Suppression du cookie de session
      res.clearCookie('cerisonet.sid');
      res.status(200).json({
        success: true,
        message: "Déconnexion réussie"
      });
    });
  } catch (error) {
    console.error("Erreur lors de la déconnexion:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la déconnexion"
    });
  }
});

export default router;
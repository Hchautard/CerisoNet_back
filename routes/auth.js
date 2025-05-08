/**
 * Routes d'authentification
 * Gestion de la connexion et déconnexion des utilisateurs
 */

import express from 'express';
import crypto from 'crypto';
import { getPostgresPool, updateUserConnectionStatus } from '../services/postgres.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           description: Adresse email de l'utilisateur
 *         password:
 *           type: string
 *           description: Mot de passe de l'utilisateur
 *       example:
 *         email: utilisateur@example.com
 *         password: motdepasse123
 *     
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID unique de l'utilisateur
 *         mail:
 *           type: string
 *           description: Adresse email de l'utilisateur
 *         nom:
 *           type: string
 *           description: Nom de famille de l'utilisateur
 *         prenom:
 *           type: string
 *           description: Prénom de l'utilisateur
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Date et heure de la dernière connexion
 *       example:
 *         id: 1
 *         mail: utilisateur@example.com
 *         nom: Dupont
 *         prenom: Jean
 *         lastLogin: 2025-03-11T14:30:00.000Z
 *     
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indique si l'opération a réussi
 *         message:
 *           type: string
 *           description: Message descriptif du résultat
 *         user:
 *           $ref: '#/components/schemas/User'
 *       example:
 *         success: true
 *         message: Connexion réussie
 *         user:
 *           id: 1
 *           mail: utilisateur@example.com
 *           nom: Dupont
 *           prenom: Jean
 *           lastLogin: 2025-03-11T14:30:00.000Z
 */

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Connexion d'un utilisateur
 *     description: Authentifie un utilisateur et crée une session
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Données de connexion incomplètes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Email et mot de passe requis
 *       401:
 *         description: Authentification échouée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Mot de passe incorrect
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Erreur serveur lors de la connexion
 */
router.post('/login', async (req, res, next) => {
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
 * @swagger
 * /logout:
 *   post:
 *     summary: Déconnexion d'un utilisateur
 *     description: Détruit la session et met à jour le statut de connexion
 *     tags: [Authentification]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Déconnexion réussie
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Erreur lors de la déconnexion
 */
router.post('/logout', async (req, res, next) => {
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
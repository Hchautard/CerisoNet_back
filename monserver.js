/**
 * Serveur Express pour l'application CERISoNet
 * Ce serveur gère l'authentification, les sessions et sert l'application front-end
 * Il utilise HTTPS pour la sécurité des communications
 * 
 * @author: Hugo CHAUTARD
 * @date: 11/03/2025
 */

// ======= IMPORTS DES MODULES NÉCESSAIRES =======
// Modules pour le serveur web et les manipulations de fichiers
import express from "express";
import cors from "cors";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Modules pour les bases de données
import pkg from 'pg';
const { Pool } = pkg;

// Modules pour la sécurité et les sessions
import crypto from 'crypto';
import session from 'express-session';
import connectMongoDBSession from 'connect-mongodb-session';

// Module pour les variables d'environnement
import * as dotenv from 'dotenv';
 
// Chargement des variables d'environnement depuis .env
dotenv.config();

// ======= CONFIGURATION DES CHEMINS =======
// Obtention du chemin absolu du fichier pour manipuler correctement les fichiers
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ======= CONFIGURATION DU SERVEUR =======
const PORT_HTTPS = 3221;
const app = express();

// Middleware pour analyser le JSON des requêtes entrantes
app.use(express.json());

// ======= CONFIGURATION DES FICHIERS STATIQUES =======
/**
 * Configuration du middleware pour servir les fichiers statiques
 * Gère spécifiquement le MIME type pour les fichiers CSS
 * Chemin: /CerisoNet/dist/ceriso-net/browser/
 */
app.use(express.static(__dirname + '/CerisoNet/dist/ceriso-net/browser/', {
  setHeaders: function (res, path) {
    if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    }
  }
}));

// ======= CONFIGURATION DU CORS =======
/**
 * Cross-Origin Resource Sharing
 * Permet les requêtes depuis le front-end tournant sur un autre port
 */
app.use(cors({
    origin: "http://localhost:3222",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true, // Permet l'envoi de cookies à travers les requêtes CORS
}));

// ======= CONFIGURATION HTTPS =======
/**
 * Chargement des certificats SSL pour sécuriser les communications
 * Les certificats doivent être correctement générés et placés à la racine du projet
 */
const options = {
    key: fs.readFileSync("private-key.pem"),
    cert: fs.readFileSync("certificate.pem"),
};

// ======= CONFIGURATION DES SESSIONS MONGODB =======
/**
 * Utilisation de MongoDB pour stocker les sessions utilisateurs
 */
const MongoDBStore = connectMongoDBSession(session);
const store = new MongoDBStore({
  uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cerisodb',
  collection: 'MySession3221',
  expires: 1000 * 60 * 60 * 24 * 7, // 1 semaine (en millisecondes)
});

// Gestion des erreurs de connexion à MongoDB
store.on('error', function(error) {
  console.log('Erreur de stockage de session MongoDB:', error);
});

// ======= CONFIGURATION DES SESSIONS =======
/**
 * Configuration du middleware de session
 * Définit comment les sessions sont stockées et gérées
 */
app.use(session({
  secret: process.env.SESSION_SECRET || 'cerisonet_secret_key',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 semaine
    secure: true, 
    httpOnly: true,
    sameSite: 'none' 
  },
  store: store, // Stockage MongoDB
  resave: false, 
  saveUninitialized: false, 
  name: 'cerisonet.sid' 
}));

// ======= ROUTES PUBLIQUES =======
/**
 * Route principale
 * Renvoie l'application Angular buildée
 */
app.get('/', (req, res) => {
    res.sendFile("index.html", { root: path.join(__dirname, "/CerisoNet/dist/ceriso-net/browser/") });
});

// ======= MIDDLEWARES =======
/**
 * Middleware d'authentification
 * Vérifie si l'utilisateur est connecté avant d'accéder aux routes protégées
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
const authMiddleware = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ success: false, message: "Non authentifié" });
  }
};

// ======= ROUTES D'AUTHENTIFICATION =======
/**
 * Route de connexion (login)
 * Vérifie les identifiants utilisateur contre la base PostgreSQL
 * Crée une session si authentification réussie
 */
app.post('/login', async (req, res) => {
    // ===== Création du pool de connexion PostgreSQL =====
    const pgPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
    });

    // Test de la connexion à PostgreSQL
    pgPool.connect((err, client, done) => {
      if (err) {
        console.error("Erreur de connexion à PostgreSQL:", err);
      } else {
        console.log("Connexion à PostgreSQL réussie");
      }
    });

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

     // Recherche de l'utilisateur dans la base PostgreSQL
     // Note: La table est dans le schéma 'fredouil'
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

// ======= ROUTES PROTÉGÉES =======
/**
 * Route pour récupérer les informations de l'utilisateur connecté
 * Nécessite d'être authentifié (via authMiddleware)
 */
app.get('/user', authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.session.user
  });
});

/**
 * Route de déconnexion (logout)
 * Détruit la session et efface le cookie
 */
app.post('/logout', (req, res) => {
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
});

/**
 * POUR TESTER : NE PAS TENIR COMPTE
 * 
 * Route pour récupérer les posts du mur d'accueil
 * Nécessite d'être authentifié (via authMiddleware)
 * 
 * Actuellement retourne des données fictives
 * À l'avenir, devra se connecter à MongoDB pour récupérer les vrais posts
 */
app.get('/posts', authMiddleware, async (req, res) => {
  try {
    const posts = [
      {
        id: 1,
        content: "Premier post sur CERISoNet",
        author: "Admin",
        likes: 5,
        comments: 2,
        date: new Date().toISOString()
      },
      {
        id: 2,
        content: "Bienvenue sur le réseau social du CERI!",
        author: "System",
        likes: 10,
        comments: 3,
        date: new Date().toISOString()
      }
    ];
    
    res.status(200).json({
      success: true,
      posts
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des posts:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des posts"
    });
  }
});

// ======= GESTION DES ERREURS =======
/**
 * Route générique pour les erreurs serveur
 */
app.get("/error", (req, res) => {
    res.status(500).json({ message: "Erreur serveur" });
});

// ======= DÉMARRAGE DU SERVEUR =======
/**
 * Création du serveur HTTPS avec les options SSL
 * et démarrage sur le port 3221
 */
https.createServer(options, app).listen(PORT_HTTPS, () => {
    console.log(`Serveur HTTPS en écoute sur https://localhost:${PORT_HTTPS}`);
});
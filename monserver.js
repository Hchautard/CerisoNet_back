import express from "express";
import cors from "cors";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from 'dotenv';
 
dotenv.config();

// Obtention du chemin absolu du fichier
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT_HTTPS = 3221;

const app = express();

// Middleware pour nanalyser le JSON des requêtes entrantes
app.use(express.json());

// Configuration de l'accès aux fichiers statiques et gestion du MIME type pour le CSS
app.use(express.static(__dirname + '/CerisoNet/dist/ceriso-net/browser/', {
  setHeaders: function (res, path) {
    if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    }
  }
}));

// Configuration du CORS pour autoriser les requêtes depuis le front
app.use(cors({
    origin: "http://localhost:3222",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}));

// Chargement des certificats SSL pour la configuration HTTPS
const options = {
    key: fs.readFileSync("private-key.pem"),
    cert: fs.readFileSync("certificate.pem"),
};

// Route principale (renvoi le index.html de l'application)
app.get('/', (req, res) => {
    res.sendFile("index.html", { root: path.join(__dirname, "/CerisoNet/dist/ceriso-net/browser/") });
});

// Middleware de vérification d'authentification
const authMiddleware = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ success: false, message: "Non authentifié" });
  }
};

// Informations de connexion à PostgreSQL

// Route de connexion 
app.post('/login', async (req, res) => {

    // Config de la connexion à PostgreSQL
    const pgPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
    });

    console.log(process.env.DB_USER,
      process.env.DB_HOST,
      process.env.DB_NAME,
      process.env.DB_PASSWORD,
      parseInt(process.env.DB_PORT || '5432')
    )

    // Vérification de la connexion à PostgreSQL
    pgPool.connect((err, client, done) => {
      if (err) {
        console.error("Erreur de connexion à PostgreSQL:", err);
      } else {
        console.log("Connexion à PostgreSQL réussie");
      }
    });

   try {
     const { email, password } = req.body;
     
     // Vérification des entrées
     if (!email || !password) {
       return res.status(400).json({
         success: false,
         message: "Email et mot de passe requis"
       });
     }

     // Recherche de l'utilisateur dans PostgreSQL
     const result = await pgPool.query(
       'SELECT * FROM compte WHERE email = $1',
       [email]
     );

     const user = result.rows[0];
     
     // Vérifiez si l'utilisateur existe et si le mot de passe correspond
     // Note: Dans un vrai projet, utilisez bcrypt pour comparer les mots de passe hachés
     if (!user || user.password !== password) {
       return res.status(401).json({
         success: false,
         message: "Email ou mot de passe incorrect"
       });
     }

     // Stockez les informations de l'utilisateur dans la session
     req.session.user = {
       id: user.id,
       email: user.email,
       nom: user.nom,
       prenom: user.prenom,
       lastLogin: new Date().toISOString()
     };

     // Envoie de la réponse au client
     res.status(200).json({
       success: true,
       message: "Connexion réussie",
       user: {
         id: user.id,
         email: user.email,
         nom: user.nom,
         prenom: user.prenom,
         lastLogin: new Date().toISOString()
       }
     });
   } catch (error) {
     console.error("Erreur de connexion:", error);
     res.status(500).json({
       success: false,
       message: "Erreur de serveur lors de la connexion"
     });
   }
});

// Route pour récupérer les infos de l'utilisateur connecté
app.get('/user', authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.session.user
  });
});

// Route pour la déconnexion
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la déconnexion"
      });
    }
    
    res.clearCookie('cerisonet.sid');
    res.status(200).json({
      success: true,
      message: "Déconnexion réussie"
    });
  });
});

// Route pour récupérer les posts pour le mur d'accueil
app.get('/posts', authMiddleware, async (req, res) => {
  try {
    // Cette route devra accéder à MongoDB pour récupérer les posts
    // Pour l'instant, on renvoie des données fictives
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


// Route si erreur
app.get("/error", (req, res) => {
    res.status(500).json({ message: "Erreur serveur" });
});


// Création du serveur HTTPS et écoute sur le port défini (3221)
https.createServer(options, app).listen(PORT_HTTPS, () => {
    console.log(`Serveur HTTPS en écoute sur https://localhost:${PORT_HTTPS}`);
});

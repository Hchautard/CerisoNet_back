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
import { MongoClient, ObjectId } from 'mongodb';

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
  uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/db-CERI',
  collection: 'MySession3221',
  expires: 1000 * 60 * 60 * 24 * 7, // 1 semaine (en millisecondes)
});

// Variable globale pour stocker la connexion MongoDB
let mongoClient;
let cerisonetCollection;
let dbConnected = false;

// Fonction pour initialiser la connexion MongoDB
async function connectToMongoDB() {
  try {
    mongoClient = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/db-CERI');
    await mongoClient.connect();
    console.log('Connexion établie pour accéder à la collection CERISoNet');
      
    const db = mongoClient.db();
    cerisonetCollection = db.collection('CERISoNet');
    dbConnected = true;
      
    // Récupérer et afficher quelques documents pour vérification
    const documents = await cerisonetCollection.find({}).limit(5).toArray();
    console.log('Aperçu des documents dans la collection CERISoNet:');
    documents.forEach(doc => console.log(`ID: ${doc._id}, Date: ${doc.date}, Auteur: ${doc.createdBy}`));
    
    return true;
  } catch (err) {
    console.error('Erreur lors de l\'accès à la collection:', err);
    return false;
  }
}

// Gestion de la connexion à MongoDB
store.on('connected', async () => {
  console.log('Connecté à MongoDB pour le stockage des sessions');
  await connectToMongoDB();
});

// Gestion des erreurs de connexion à MongoDB
store.on('error', function(error) {
  console.log('Erreur de stockage de session MongoDB:', error);
});

// Middleware pour vérifier la connexion à MongoDB
const checkMongoConnection = async (req, res, next) => {
  if (!dbConnected) {
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

   // Mise à jour du statut de connexion à 1 (connecté)
   await pgPool.query(
     'UPDATE fredouil.compte SET statut_connexion = 1 WHERE id = $1',
     [user.id]
   );
   console.log(`Statut de connexion mis à jour à 1 pour l'utilisateur ${user.id}`);

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
 * Route pour récupérer les utilisateurs connectés
 * Nécessite d'être authentifié (via authMiddleware)
 */
app.get('/users/connected', authMiddleware, async (req, res) => {
  try {
    // Connexion à PostgreSQL
    const pgPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
    });
    
    // Récupérer les utilisateurs avec statut_connexion = 1
    const result = await pgPool.query(
      'SELECT id, nom, prenom FROM fredouil.compte WHERE statut_connexion = 1'
    );
    
    res.status(200).json({
      success: true,
      connectedUsers: result.rows
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs connectés:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des utilisateurs connectés"
    });
  }
});

/**
 * Route de déconnexion (logout)
 * Détruit la session et efface le cookie
 */
app.post('/logout', async (req, res) => {
  try {
    // Récupérer l'ID de l'utilisateur avant de détruire la session
    const userId = req.session.user ? req.session.user.id : null;
    
    if (userId) {
      // Mise à jour du statut de connexion à 0 (déconnecté)
      const pgPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
      });
      
      await pgPool.query(
        'UPDATE fredouil.compte SET statut_connexion = 0 WHERE id = $1',
        [userId]
      );

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

/**
 * 
 * Route pour récupérer les posts du mur d'accueil
 * Nécessite d'être authentifié (via authMiddleware)
 * 
 * Se connecter à MongoDB pour récupérer les vrais posts
 */
app.get('/posts', authMiddleware, checkMongoConnection, async (req, res) => {
  try {
    // Vérification de la connexion à MongoDB
    if (!cerisonetCollection) {
      // Si la collection n'est pas encore disponible, tenter de se reconnecter
      try {
        mongoClient = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/db-CERI');
        await mongoClient.connect();
        const db = mongoClient.db();
        cerisonetCollection = db.collection('CERISoNet');
      } catch (error) {
        console.error('Erreur lors de la tentative de reconnexion à MongoDB:', error);
        return res.status(500).json({
          success: false,
          message: "Erreur de connexion à la base de données MongoDB"
        });
      }
    }

    // Récupération des posts depuis la collection CERISoNet, triés par date décroissante
    const mongoMessages = await cerisonetCollection.find({}).sort({ date: -1, hour: -1 }).limit(20).toArray();

    console.log("Récupération des posts depuis MongoDB réussie, nombre de posts:", mongoMessages.length);
    
    // Récupération des utilisateurs pour obtenir les noms d'auteurs
    const pgPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
    });
    
    const usersResult = await pgPool.query('SELECT id, nom, prenom FROM fredouil.compte');
    const usersMap = new Map();
    usersResult.rows.forEach(user => {
      usersMap.set(user.id, {
        name: `${user.prenom} ${user.nom}`,
        prenom: user.prenom,
        nom: user.nom
      });
    });
    
    // Transformer les posts pour le format attendu par le frontend
    const posts = await Promise.all(mongoMessages.map(async post => {
      // Récupérer les infos de l'auteur
      const authorInfo = usersMap.get(post.createdBy) || { name: "Utilisateur inconnu" };
      
      // Gérer les commentaires (ajouter les noms des commentateurs)
      const commentWithNames = post.comments ? post.comments.map(comment => {
        const commentAuthor = usersMap.get(comment.commentedBy) || { name: "Utilisateur inconnu" };
        return {
          ...comment,
          commentedByName: commentAuthor.name
        };
      }) : [];
      
      // Gérer les posts partagés
      let sharedFromName = undefined;
      if (post.isShared && post.sharedFrom) {
        const sharedAuthor = usersMap.get(post.sharedFrom);
        sharedFromName = sharedAuthor ? sharedAuthor.name : "Utilisateur inconnu";
      }
      
      // Construire l'objet post final
      return {
        id: post._id.toString(),
        content: post.body || "",
        author: authorInfo.name,
        authorId: post.createdBy,
        likes: post.likes || 0,
        likedBy: post.likedBy || [],
        images: post.images || [],
        comments: commentWithNames,
        date: post.date && post.hour ? `${post.date}T${post.hour}` : new Date().toISOString(),
        hashtags: post.hashtags || [],
        isShared: post.isShared || false,
        sharedFrom: post.sharedFrom,
        sharedFromName: sharedFromName,
        originalPost: post.originalPost || null
      };
    }));
    
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

// ======= AJOUT DE SOCKET.IO =======
import { Server as SocketServer } from 'socket.io';

const httpsServer = https.createServer(options, app);

// ======= CONFIGURATION DE SOCKET.IO =======
const io = new SocketServer(httpsServer, {
  cors: {
    origin: "https://localhost:3222", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ======= GESTION DES CONNEXIONS WEBSOCKET =======
// Map pour stocker les utilisateurs connectés
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('Nouvelle connexion WebSocket établie');
  
  // Authentification de la connexion WebSocket
  socket.on('authenticate', async (userData) => {
    if (userData && userData.id) {
      console.log(`Utilisateur ${userData.prenom} ${userData.nom} authentifié via WebSocket`);
      
      // Mise à jour du statut de connexion dans PostgreSQL
      try {
        const pgPool = new Pool({
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASSWORD,
          port: parseInt(process.env.DB_PORT || '5432'),
        });
        
        await pgPool.query(
          'UPDATE fredouil.compte SET statut_connexion = 1 WHERE id = $1',
          [userData.id]
        );
        
        console.log(`Statut de connexion mis à jour pour l'utilisateur ${userData.id}`);
      } catch (error) {
        console.error("Erreur lors de la mise à jour du statut de connexion:", error);
      }
      
      // Stockage de l'utilisateur dans la map des utilisateurs connectés
      connectedUsers.set(userData.id, {
        socket: socket.id,
        userData
      });
      
      // Récupération de tous les utilisateurs connectés depuis PostgreSQL
      try {
        const pgPool = new Pool({
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASSWORD,
          port: parseInt(process.env.DB_PORT || '5432'),
        });
        
        const result = await pgPool.query(
          'SELECT id, nom, prenom FROM fredouil.compte WHERE statut_connexion = 1 AND id != $1',
          [userData.id]
        );
        
        // Notification à tous les autres utilisateurs de la nouvelle connexion
        socket.broadcast.emit('user-connected', {
          id: userData.id,
          nom: userData.nom,
          prenom: userData.prenom
        });
        
        // Envoi de la liste des utilisateurs connectés à l'utilisateur qui vient de se connecter
        socket.emit('connected-users', result.rows);
      } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs connectés:", error);
        socket.emit('connected-users', []);
      }
    }
  });
  
  
  // Gestion des likes
  socket.on('like-post', async (data) => {
    try {
      const { postId, userId } = data;
      
      // Validation des données
      if (!postId || !userId) {
        socket.emit('error', { message: "Données de like incomplètes" });
        return;
      }
      
      console.log(`Tentative de like du post ${postId} par l'utilisateur ${userId}`);
      
      // Conversion en ObjectId pour MongoDB
      let postObjectId;
      try {
        postObjectId = new ObjectId(postId.toString());
      } catch (error) {
        console.error("ID de post invalide pour like:", error);
        socket.emit('error', { message: "Format d'ID de post invalide" });
        return;
      }
      
      // Vérifier si l'utilisateur a déjà liké ce post
      const post = await cerisonetCollection.findOne({ 
        _id: postObjectId,
        likedBy: { $elemMatch: { $eq: userId } }
      });
      
      let totalLikes;
      
      if (post) {
        // L'utilisateur a déjà liké ce post, on pourrait soit ne rien faire,
        // soit retirer le like (dislike)
        socket.emit('error', { message: "Vous avez déjà liké ce post" });
        return;
      } else {
        // Ajouter le like et incrémenter le compteur
        const updateResult = await cerisonetCollection.updateOne(
          { _id: postObjectId },
          { 
            $inc: { likes: 1 },
            $push: { likedBy: userId }
          }
        );
        
        if (!updateResult.matchedCount) {
          socket.emit('error', { message: "Post non trouvé" });
          return;
        }
        
        // Récupérer le nombre total de likes après mise à jour
        const updatedPost = await cerisonetCollection.findOne({ _id: postObjectId });
        totalLikes = updatedPost.likes || 1;
      }
      
      // Notification à tous les utilisateurs du nouveau like
      io.emit('post-liked', {
        postId: postId.toString(),
        userId,
        totalLikes
      });
      
    } catch (error) {
      console.error("Erreur lors du traitement du like:", error);
      socket.emit('error', { message: "Erreur lors du traitement du like" });
    }
  });
  
  // Gestion des commentaires
  socket.on('add-comment', async (data) => {
    try {
      const { postId, userId, content, userName } = data;
      
      // Validation des données
      if (!postId || !userId || !content) {
        socket.emit('error', { message: "Données de commentaire incomplètes" });
        return;
      }
      
      console.log(`Tentative d'ajout de commentaire au post ${postId} par l'utilisateur ${userId}`);
      
      // Conversion en ObjectId pour MongoDB
      let postObjectId;
      try {
        postObjectId = new ObjectId(postId.toString());
      } catch (error) {
        console.error("ID de post invalide pour commentaire:", error);
        socket.emit('error', { message: "Format d'ID de post invalide" });
        return;
      }
      
      // Création du commentaire
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];
      
      const newComment = {
        id: new ObjectId().toString(), // Générer un ID unique
        commentedBy: userId,
        text: content,
        date: dateStr,
        hour: timeStr
      };
      
      // Ajouter le commentaire au post
      const updateResult = await cerisonetCollection.updateOne(
        { _id: postObjectId },
        { $push: { comments: newComment } }
      );
      
      if (!updateResult.matchedCount) {
        socket.emit('error', { message: "Post non trouvé" });
        return;
      }
      
      console.log(`Commentaire ajouté avec succès au post ${postId}`);
      
      // Notification à tous les utilisateurs du nouveau commentaire
      io.emit('new-comment', {
        id: newComment.id,
        postId: postId.toString(),
        userId,
        userName,
        commentedByName: userName,
        text: content,
        date: dateStr,
        hour: timeStr
      });
      
    } catch (error) {
      console.error("Erreur lors de l'ajout du commentaire:", error);
      socket.emit('error', { message: "Erreur lors de l'ajout du commentaire" });
    }
  });
  
 // Gestion des partages
 socket.on('share-post', async (data) => {
  try {
    const { postId, userId, userName } = data;
    
    // Validation des données reçues
    if (!postId || !userId) {
      socket.emit('error', { message: "Les données de partage sont incomplètes" });
      return;
    }
    
    console.log(`Tentative de partage du post ${postId} par l'utilisateur ${userId}`);
    
    // Conversion de l'ID du post en ObjectId pour MongoDB
    let postObjectId;
    try {
      postObjectId = new ObjectId(postId);  // Conversion en string puis en ObjectId
    } catch (error) {
      console.error("ID de post invalide:", error);
      socket.emit('error', { message: "Format d'ID de post invalide" });
      return;
    }
    
    // Vérifier que le post existe dans MongoDB
    const post = await cerisonetCollection.findOne({ _id: postObjectId });
    
    if (!post) {
      console.error(`Post avec ID ${postId} non trouvé dans la base de données`);
      socket.emit('error', { message: "Post non trouvé" });
      return;
    }
    
    // Création d'un nouveau post qui est un partage
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    
    const sharedPost = {
      body: post.body,
      createdBy: userId,
      date: dateStr,
      hour: timeStr,
      originalPost: postId.toString(),
      sharedFrom: post.createdBy,
      likes: 0,
      likedBy: [],
      comments: [],
      hashtags: post.hashtags || [],
      images: post.images || [],
      isShared: true
    };
    
    console.log("Nouveau post partagé à créer:", sharedPost);
    
    // Sauvegarde du partage dans MongoDB
    const result = await cerisonetCollection.insertOne(sharedPost);
    
    if (!result.acknowledged) {
      console.error("Erreur lors de la sauvegarde du partage dans MongoDB");
      socket.emit('error', { message: "Erreur lors de la sauvegarde du partage" });
      return;
    }
    
    console.log(`Post partagé avec succès, nouvel ID: ${result.insertedId}`);
    
    // Notification à tous les utilisateurs du nouveau partage
    io.emit('post-shared', {
      postId: postId.toString(),
      newPostId: result.insertedId.toString(),
      userId,
      userName,
      date: now.toISOString()
    });
    
    // Confirmation au client qui a initié le partage
    socket.emit('share-success', {
      success: true,
      message: "Post partagé avec succès",
      newPostId: result.insertedId.toString()
    });
    
  } catch (error) {
    console.error("Erreur lors du partage du post:", error);
    socket.emit('error', { message: "Erreur lors du partage du post" });
  }
});

  socket.on('get-connected-users', async () => {
    try {
      const pgPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
      });
      
      // Récupérer les utilisateurs avec statut = 1 (connectés)
      const result = await pgPool.query(
        'SELECT id, nom, prenom FROM fredouil.compte WHERE statut_connexion = 1'
      );
      
      // Envoyer la liste à l'utilisateur qui a fait la demande
      socket.emit('connected-users', result.rows);
    } catch (error) {
      console.error("Erreur lors de la récupération des utilisateurs connectés:", error);
      socket.emit('connected-users', []);
    }
  });
  
  // Gestion de la déconnexion
  socket.on('disconnect', async () => {
    console.log('Un utilisateur s\'est déconnecté');
    
    // Recherche de l'utilisateur dans la map
    let disconnectedUserId = null;
    connectedUsers.forEach((value, key) => {
      if (value.socket === socket.id) {
        disconnectedUserId = key;
      }
    });
    
    // Si on trouve l'utilisateur, on le supprime et notifie les autres
    if (disconnectedUserId) {
      const userData = connectedUsers.get(disconnectedUserId).userData;
      connectedUsers.delete(disconnectedUserId);
      
      // Mise à jour du statut de connexion dans PostgreSQL
      try {
        const pgPool = new Pool({
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASSWORD,
          port: parseInt(process.env.DB_PORT || '5432'),
        });
        
        await pgPool.query(
          'UPDATE fredouil.compte SET statut_connexion = 0 WHERE id = $1',
          [disconnectedUserId]
        );
        
        console.log(`Statut de connexion mis à jour pour l'utilisateur ${disconnectedUserId}`);
      } catch (error) {
        console.error("Erreur lors de la mise à jour du statut de déconnexion:", error);
      }
      
      // Notification à tous les autres utilisateurs de la déconnexion
      socket.broadcast.emit('user-disconnected', {
        id: disconnectedUserId,
        nom: userData.nom,
        prenom: userData.prenom
      });
    }
  });
});

// ======= DÉMARRAGE DU SERVEUR =======
/**
 * Création du serveur HTTPS avec les options SSL
 * et démarrage sur le port 3221
 */
httpsServer.listen(PORT_HTTPS, () => {
  console.log(`Serveur HTTPS en écoute sur https://localhost:${PORT_HTTPS}`);
});

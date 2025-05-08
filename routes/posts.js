/**
 * Routes pour la gestion des posts
 * Récupération et filtrage des posts du mur d'accueil
 */

import express from 'express';
import authMiddleware from '../middlewares/auth.js';
import checkMongoConnection from '../middlewares/db-connection.js';
import { getCerisonetCollection } from '../services/mongo.js';
import { getAllUsers } from '../services/postgres.js';

const router = express.Router();

/**
 * Route pour récupérer les posts du mur d'accueil avec pagination
 * GET /posts
 * 
 * Paramètres de requête:
 * - page: numéro de page (défaut: 1)
 * - pageSize: nombre de posts par page (défaut: 10)
 * - hashtag: (optionnel) filtre par hashtag
 * - filterByOwner: (optionnel) 'me', 'others', 'all'
 * - userId: (optionnel) ID de l'utilisateur pour le filtre
 * - sortBy: (optionnel) 'date', 'owner', 'popularity'
 * - sortDirection: (optionnel) 'asc', 'desc'
 */
router.get('/posts', authMiddleware, checkMongoConnection, async (req, res) => {
  try {
    // Récupération de la collection MongoDB
    const cerisonetCollection = await getCerisonetCollection();
    if (!cerisonetCollection) {
      return res.status(500).json({
        success: false,
        message: "Erreur de connexion à la base de données MongoDB"
      });
    }

    // Récupération des paramètres de pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;
    
    // Construction du filtre
    const filter = {};
    
    // Filtre par hashtag si présent
    if (req.query.hashtag) {
      filter.hashtags = req.query.hashtag;
    }

    // Filtre par propriétaire 
    if (req.query.filterByOwner && req.query.userId) {
      const userId = parseInt(req.query.userId);
      
      if (req.query.filterByOwner === 'me') {
        // Afficher uniquement les posts de l'utilisateur connecté
        filter.createdBy = userId;
      } else if (req.query.filterByOwner === 'others') {
        // Afficher uniquement les posts des autres utilisateurs
        filter.createdBy = { $ne: userId };
      }
      // 'all' ne nécessite pas de filtre particulier
    }

    // Compte total des posts pour la pagination
    const totalPosts = await cerisonetCollection.countDocuments(filter);
    
    // Configuration du tri
    let sortOptions = {};
    
    if (req.query.sortBy) {
      const direction = req.query.sortDirection === 'asc' ? 1 : -1;
      
      switch(req.query.sortBy) {
        case 'date':
          // Tri par date
          sortOptions = { date: direction, hour: direction };
          break;
        case 'owner':
          // Tri par propriétaire
          sortOptions = { createdBy: direction, date: -1, hour: -1 };
          break;
        case 'popularity':
          // Tri par popularité (nombre de likes)
          sortOptions = { likes: direction, date: -1, hour: -1 };
          break;
        default:
          // Tri par défaut: date décroissante
          sortOptions = { date: -1, hour: -1 };
      }
    } else {
      // Tri par défaut: date décroissante
      sortOptions = { date: -1, hour: -1 };
    }
    
    // Récupération des posts depuis la collection CERISoNet avec tri et pagination
    const mongoMessages = await cerisonetCollection.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    console.log(`Récupération des posts depuis MongoDB réussie, page ${page}, taille ${pageSize}, nombre de posts: ${mongoMessages.length}`);
    
    // Récupération des utilisateurs pour obtenir les noms d'auteurs
    const users = await getAllUsers();
    const usersMap = new Map();
    users.forEach(user => {
      usersMap.set(user.id, {
        name: `${user.prenom} ${user.nom}`,
        prenom: user.prenom,
        nom: user.nom,
        avatar: user.avatar
      });
    });
    
    // Transformer les posts pour le format attendu par le frontend
    const posts = await Promise.all(mongoMessages.map(async post => {
      // Récupérer les infos de l'auteur
      const authorUser = usersMap.get(post.createdBy) || { name: "Utilisateur inconnu" };
      
      // Gérer les commentaires (ajouter les noms des commentateurs)
      const commentWithNames = post.comments ? post.comments.map(comment => {
        const commentAuthor = usersMap.get(comment.commentedBy) || { name: "Utilisateur inconnu" };
        return {
          ...comment,
          commentedByName: commentAuthor.name,
          commentedByAvatar: commentAuthor.avatar
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
        id: post._id,
        content: post.body || "",
        author: authorUser.name,
        authorAvatar: authorUser.avatar || "",
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
      posts,
      total: totalPosts,
      page,
      pageSize,
      totalPages: Math.ceil(totalPosts / pageSize)
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des posts:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des posts"
    });
  }
});

export default router;
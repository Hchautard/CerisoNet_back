/**
 * Gestionnaire des événements de like
 * Traite les likes et les notifications en temps réel
 */

import { ObjectId } from 'mongodb';
import { getCerisonetCollection } from '../../services/mongo.js';

/**
 * Configure le gestionnaire d'événements de like
 * @param {SocketServer} io - Instance de Socket.IO
 * @param {Socket} socket - Connexion socket individuelle
 */
const likeHandler = (io, socket) => {
  
  /**
   * Gère l'événement 'like-post'
   * @param {Object} data - Données du like
   * @param {string} data.postId - ID du post
   * @param {number} data.userId - ID de l'utilisateur
   */
  socket.on('like-post', async (data) => {
    try {
      const { postId, userId } = data;
      
      // Validation des données
      if (!postId || !userId) {
        socket.emit('error', { message: "Données de like incomplètes" });
        return;
      }
      
      console.log(`Tentative de like du post ${postId} par l'utilisateur ${userId}`);
      
      // Récupération de la collection MongoDB
      const cerisonetCollection = await getCerisonetCollection();
      if (!cerisonetCollection) {
        socket.emit('error', { message: "Erreur de connexion à la base de données MongoDB" });
        return;
      }
      
      // Conversion en ObjectId pour MongoDB
      let postObjectId;
      try {
        postObjectId = new ObjectId(postId);
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
        // L'utilisateur a déjà liké ce post
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
        postId: postId,
        userId,
        totalLikes
      });
      
    } catch (error) {
      console.error("Erreur lors du traitement du like:", error);
      socket.emit('error', { message: "Erreur lors du traitement du like" });
    }
  });
};

export default likeHandler;
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
      
      console.log(`Tentative de like du post ${postId} par l'utilisateur ${userId}`);
      
      // Récupération de la collection MongoDB
      const cerisonetCollection = await getCerisonetCollection();
      if (!cerisonetCollection) {
        socket.emit('error', { message: "Erreur de connexion à la base de données MongoDB" });
        return;
      }
      
      // Vérifier si l'utilisateur a déjà liké ce post
      const post = await cerisonetCollection.findOne({ 
        _id: postId,
        likedBy: userId
      });
      
      if (post) {
        socket.emit('error', { message: "Vous avez déjà liké ce post" });
        return;
      } else {
        
        const updateResult = await cerisonetCollection.updateOne(
          { _id: postId },
          { 
            $inc: { likes: 1 },
            $push: { likedBy: userId }
          }
        );
        
        if (!updateResult.matchedCount) {
          socket.emit('error', { message: "Post non trouvé" });
          return;
        }
        
      }
      
      // Notification du like à l' utilisateur
      io.emit('post-liked', {
        postId: postId,
        userId: userId,
        success: true
      });
      
    } catch (error) {
      console.error("Erreur lors du traitement du like:", error);
      socket.emit('error', { message: "Erreur lors du traitement du like" });

      socket.emit('post-liked', {
        postId: data.postId,
        userId: data.userId,
        success: false
      });
    }
  });
};

export default likeHandler;
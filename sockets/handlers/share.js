/**
 * Gestionnaire des événements de partage
 * Traite les partages de posts et les notifications en temps réel
 */

import { ObjectId } from 'mongodb';
import { getCerisonetCollection } from '../../services/mongo.js';

/**
 * Configure le gestionnaire d'événements de partage
 * @param {SocketServer} io - Instance de Socket.IO
 * @param {Socket} socket - Connexion socket individuelle
 */
const shareHandler = (io, socket) => {
  
  /**
   * Gère l'événement 'share-post'
   * @param {Object} data - Données du partage
   * @param {string} data.postId - ID du post à partager
   * @param {number} data.userId - ID de l'utilisateur qui partage
   * @param {string} data.userName - Nom de l'utilisateur qui partage
   */
  socket.on('share-post', async (data) => {
    try {
      const { postId, userId, userName } = data;
      
      // Validation des données reçues
      if (!postId || !userId) {
        socket.emit('error', { message: "Les données de partage sont incomplètes" });
        return;
      }
      
      console.log(`Tentative de partage du post ${postId} par l'utilisateur ${userId}`);
      
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
        originalPost: postId,
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
        postId: postId,
        newPostId: result.insertedId,
        userId,
        userName,
        date: now.toISOString()
      });
      
      // Confirmation au client qui a initié le partage
      socket.emit('share-success', {
        success: true,
        message: "Post partagé avec succès",
        newPostId: result.insertedId
      });
      
    } catch (error) {
      console.error("Erreur lors du partage du post:", error);
      socket.emit('error', { message: "Erreur lors du partage du post" });
    }
  });
};

export default shareHandler;
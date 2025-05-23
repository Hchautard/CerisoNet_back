/**
 * Gestionnaire des événements de commentaire
 * Traite les commentaires et les notifications en temps réel
 */

import { ObjectId } from 'mongodb';
import { getCerisonetCollection } from '../../services/mongo.js';

/**
 * Configure le gestionnaire d'événements de commentaire
 * @param {SocketServer} io - Instance de Socket.IO
 * @param {Socket} socket - Connexion socket individuelle
 */
const commentHandler = (io, socket) => {
  
  /**
   * Gère l'événement 'add-comment'
   * @param {Object} data - Données du commentaire
   * @param {string} data.postId - ID du post
   * @param {number} data.userId - ID de l'utilisateur
   * @param {string} data.content - Contenu du commentaire
   * @param {string} data.userName - Nom de l'utilisateur
   */
  socket.on('add-comment', async (data) => {
    try {
      const { postId, userId, userName, content } = data;
      
      console.log(`Tentative d'ajout de commentaire au post ${postId} par l'utilisateur ${userId}`);
      
      // Récupération de la collection MongoDB
      const cerisonetCollection = await getCerisonetCollection();
      if (!cerisonetCollection) {
        socket.emit('error', { message: "Erreur de connexion à la base de données MongoDB" });
        return;
      }
      
      // Création du commentaire
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];
      
      const newComment = {
        id: new ObjectId(), // Générer un ID unique
        commentedBy: userId,
        text: content,
        date: dateStr,
        hour: timeStr
      };
      
      // Ajouter le commentaire au post
      const updateResult = await cerisonetCollection.updateOne(
        { _id: postId },
        { $push: { comments: newComment } }
      );
      
      if (!updateResult) {
        socket.emit('error', { message: "Post non trouvé" });
        return;
      }
      
      console.log(`Commentaire ajouté avec succès au post ${postId}`);
      
      io.emit('new-comment', {
        id: newComment.id,
        postId: postId,
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
};

export default commentHandler;
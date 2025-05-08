/**
 * Configuration de Socket.IO
 * Gestion des connexions WebSocket et des événements en temps réel
 */

import { Server as SocketServer } from 'socket.io';
import { serverConfig } from '../config/server.js';
import { updateUserConnectionStatus, getConnectedUsers } from '../services/postgres.js';

// Importation des gestionnaires d'événements
import likeHandler from './handlers/like.js';
import commentHandler from './handlers/comment.js';
import shareHandler from './handlers/share.js';

// Map pour stocker les utilisateurs connectés
const connectedUsers = new Map();

/**
 * Configure le serveur Socket.IO
 * @param {Server} server - Instance du serveur HTTP/HTTPS
 * @returns {SocketServer} Instance de Socket.IO
 */
export const configureSocketIO = (server) => {
  const io = new SocketServer(server, {
    cors: {
      origin: serverConfig.frontendURL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Gestion des connexions Socket.IO
  io.on('connection', (socket) => {
    console.log('Nouvelle connexion WebSocket établie');
    
    // Authentification de la connexion WebSocket
    socket.on('authenticate', async (userData) => {
      if (userData && userData.id) {
        console.log(`Utilisateur ${userData.prenom} ${userData.nom} authentifié via WebSocket`);
        
        // Mise à jour du statut de connexion dans PostgreSQL
        await updateUserConnectionStatus(userData.id, 1);
        
        // Stockage de l'utilisateur dans la map des utilisateurs connectés
        connectedUsers.set(userData.id, {
          socket: socket.id,
          userData
        });
        
        // Récupération de tous les utilisateurs connectés
        try {
          const connectedUsersData = await getConnectedUsers();
          
          // Notification à tous les autres utilisateurs de la nouvelle connexion
          socket.broadcast.emit('user-connected', {
            id: userData.id,
            nom: userData.nom,
            prenom: userData.prenom
          });
          
          // Envoi de la liste des utilisateurs connectés à l'utilisateur qui vient de se connecter
          socket.emit('connected-users', connectedUsersData);
        } catch (error) {
          console.error("Erreur lors de la récupération des utilisateurs connectés:", error);
          socket.emit('connected-users', []);
        }
      }
    });
    
    // Enregistrement des gestionnaires d'événements
    likeHandler(io, socket);
    commentHandler(io, socket);
    shareHandler(io, socket);
    
    // Récupération de la liste des utilisateurs connectés
    socket.on('get-connected-users', async () => {
      try {
        const connectedUsersData = await getConnectedUsers();
        socket.emit('connected-users', connectedUsersData);
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
        await updateUserConnectionStatus(disconnectedUserId, 0);
        
        // Notification à tous les autres utilisateurs de la déconnexion
        socket.broadcast.emit('user-disconnected', {
          id: disconnectedUserId,
          nom: userData.nom,
          prenom: userData.prenom
        });
      }
    });
  });

  return io;
};
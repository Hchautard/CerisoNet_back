/**
 * Service de connexion à MongoDB
 * Gestion de la connexion et de l'accès à la collection CERISoNet
 */

import { MongoClient } from 'mongodb';
import { mongoConfig } from '../config/db.js';

// Variables globales pour stocker la connexion MongoDB
let mongoClient;
let cerisonetCollection;
let dbConnected = false;

/**
 * Initialise la connexion à MongoDB
 * @returns {Promise<boolean>} Résultat de la connexion
 */
export const connectToMongoDB = async () => {
  try {
    mongoClient = new MongoClient(mongoConfig.uri);
    await mongoClient.connect();
    console.log('Connexion établie pour accéder à la collection CERISoNet');
      
    const db = mongoClient.db();
    cerisonetCollection = db.collection(mongoConfig.collection);
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
};

/**
 * Récupère la collection MongoDB pour CERISoNet
 * Si la connexion n'est pas établie, tente de se reconnecter
 * @returns {Collection|null} La collection MongoDB ou null en cas d'erreur
 */
export const getCerisonetCollection = async () => {
  if (!dbConnected || !cerisonetCollection) {
    try {
      await connectToMongoDB();
    } catch (err) {
      console.error('Erreur lors de la reconnexion à MongoDB:', err);
      return null;
    }
  }
  return cerisonetCollection;
};

/**
 * Vérifie si la connexion à MongoDB est établie
 * @returns {boolean} État de la connexion
 */
export const isConnected = () => {
  return dbConnected;
};

/**
 * Ferme la connexion à MongoDB
 */
export const closeMongoConnection = async () => {
  if (mongoClient) {
    await mongoClient.close();
    console.log('Connexion MongoDB fermée');
    dbConnected = false;
  }
};
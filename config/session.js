/**
 * Configuration des sessions
 * Gestion des sessions utilisateurs avec MongoDB
 */

import session from 'express-session';
import connectMongoDBSession from 'connect-mongodb-session';
import { mongoConfig } from './db.js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Configure le middleware de session pour Express
 * @param {Express} app - Instance de l'application Express
 */
export const configureSession = (app) => {
  // Création du store MongoDB pour les sessions
  const MongoDBStore = connectMongoDBSession(session);
  const store = new MongoDBStore({
    uri: mongoConfig.uri,
    collection: mongoConfig.sessionCollection,
    expires: 1000 * 60 * 60 * 24 * 7, // 1 semaine (en ms)
  });

  // Gestion des événements du store
  store.on('connected', () => {
    console.log('Connecté à MongoDB pour le stockage des sessions');
  });

  store.on('error', (error) => {
    console.log('Erreur de stockage de session MongoDB:', error);
  });

  // Configuration du middleware de session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'cerisonet_secret_key',
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 semaine
      secure: true,
      httpOnly: true,
      sameSite: 'none'
    },
    store: store,
    resave: false,
    saveUninitialized: false,
    name: 'cerisonet.sid'
  }));

  return store;
};
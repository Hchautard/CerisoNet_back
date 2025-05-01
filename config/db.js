/**
 * Configuration des bases de données
 * Gestion des connexions PostgreSQL et MongoDB
 */

import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Création d'un pool de connexion PostgreSQL
 * @returns {Pool} Instance du pool PostgreSQL
 */
export const createPgPool = () => {
  return new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
  });
};

/**
 * Teste la connexion PostgreSQL et affiche un message
 * @param {Pool} pool - Pool de connexion PostgreSQL
 * @returns {Promise<void>}
 */
export const testPgConnection = async (pool) => {
  try {
    const client = await pool.connect();
    console.log("Connexion à PostgreSQL réussie");
    client.release();
    return true;
  } catch (err) {
    console.error("Erreur de connexion à PostgreSQL:", err);
    return false;
  }
};

/**
 * Configuration de la connexion MongoDB
 */
export const mongoConfig = {
  uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/db-CERI',
  collection: 'CERISoNet',
  sessionCollection: 'MySession3221'
};
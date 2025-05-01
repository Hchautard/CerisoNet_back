/**
 * Service de connexion à PostgreSQL
 * Fonctions utilitaires pour les opérations PostgreSQL
 */

import { createPgPool, testPgConnection } from '../config/db.js';

/**
 * Obtient un pool de connexion PostgreSQL et vérifie la connexion
 * @returns {Promise<Pool>} Pool de connexion PostgreSQL
 */
export const getPostgresPool = async () => {
  const pool = createPgPool();
  await testPgConnection(pool);
  return pool;
};

/**
 * Met à jour le statut de connexion d'un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {number} status - Statut de connexion (0 = déconnecté, 1 = connecté)
 * @returns {Promise<boolean>} Succès de l'opération
 */
export const updateUserConnectionStatus = async (userId, status) => {
  try {
    const pool = await getPostgresPool();
    await pool.query(
      'UPDATE fredouil.compte SET statut_connexion = $1 WHERE id = $2',
      [status, userId]
    );
    console.log(`Statut de connexion mis à jour à ${status} pour l'utilisateur ${userId}`);
    return true;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de connexion:', error);
    return false;
  }
};

/**
 * Récupère les utilisateurs connectés (statut_connexion = 1)
 * @param {number} excludeUserId - ID de l'utilisateur à exclure (optionnel)
 * @returns {Promise<Array>} Liste des utilisateurs connectés
 */
export const getConnectedUsers = async (excludeUserId = null) => {
  try {
    const pool = await getPostgresPool();
    
    let query = 'SELECT id, nom, prenom, avatar FROM fredouil.compte WHERE statut_connexion = 1';
    const params = [];
    
    // Si on souhaite exclure un utilisateur spécifique
    if (excludeUserId) {
      query += ' AND id != $1';
      params.push(excludeUserId);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs connectés:', error);
    return [];
  }
};

/**
 * Récupère les informations d'un utilisateur par son ID
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<Object|null>} Informations de l'utilisateur ou null
 */
export const getUserById = async (userId) => {
  try {
    const pool = await getPostgresPool();
    const result = await pool.query(
      'SELECT id, nom, prenom, mail, avatar FROM fredouil.compte WHERE id = $1',
      [userId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Erreur lors de la récupération des informations utilisateur:', error);
    return null;
  }
};

/**
 * Récupère tous les utilisateurs avec leurs informations de base
 * @returns {Promise<Array>} Liste de tous les utilisateurs
 */
export const getAllUsers = async () => {
  try {
    const pool = await getPostgresPool();
    const result = await pool.query(
      'SELECT id, nom, prenom, avatar FROM fredouil.compte'
    );
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération de tous les utilisateurs:', error);
    return [];
  }
};
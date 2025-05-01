/**
 * Configuration du serveur
 * Paramètres HTTPS et autres configurations serveur
 */

import fs from "fs";
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Options pour le serveur HTTPS
 * Chargement des certificats SSL
 */
export const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || "./private-key.pem"),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || "./certificate.pem"),
};

/**
 * Configuration du serveur
 */
export const serverConfig = {
  portHTTPS: process.env.PORT_HTTPS || 3221,
  frontendURL: process.env.FRONTEND_URL || "https://localhost:3222",
  staticDir: process.env.STATIC_DIR || './CerisoNet/dist/ceriso-net/browser/'
};
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
  key: fs.readFileSync("../../private-key.pem"),
  cert: fs.readFileSync("../../certificate.pem"),
};

/**
 * Configuration du serveur
 */
export const serverConfig = {
  portHTTPS: process.env.PORT_HTTPS || 3221,
  frontendURL: "https://localhost:3222",
  staticDir: '../../CerisoNet/dist/ceriso-net/browser/'
};
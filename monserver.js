/**
 * Serveur Express pour l'application CERISoNet
 * Point d'entrée principal de l'application
 * 
 * @author: Hugo CHAUTARD
 * @date: 11/03/2025
 */

// ======= IMPORTS DES MODULES NÉCESSAIRES =======
import express from "express";
import https from "https";
import path from "path";
import cors from "cors";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as dotenv from 'dotenv';

// Import des configurations
import { httpsOptions } from "./config/server.js";
import { configureSession } from "./config/session.js";
import { connectToMongoDB } from "./services/mongo.js";
import { setupSwagger } from "./config/swagger.js";

// Import des routes
import authRoutes from "./routes/auth.js";
import postsRoutes from "./routes/posts.js";
import usersRoutes from "./routes/users.js";

// Import de la configuration socket.io
import { configureSocketIO } from "./sockets/socket.js";

// Chargement des variables d'environnement depuis .env
dotenv.config();

// ======= CONFIGURATION DES CHEMINS =======
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ======= CONFIGURATION DU SERVEUR =======
const PORT_HTTPS = process.env.PORT_HTTPS || 3221;
const app = express();

// Middleware pour analyser le JSON des requêtes entrantes
app.use(express.json());

// ======= CONFIGURATION DES FICHIERS STATIQUES =======
app.use(express.static(__dirname + '../../CerisoNet/dist/ceriso-net/browser/', {
  setHeaders: function (res, path) {
    if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    }
  }
}));

// ======= CONFIGURATION DU CORS =======
app.use(cors({
    origin: process.env.FRONTEND_URL || "https://localhost:3222",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}));

// ======= CONFIGURATION DES SESSIONS =======
configureSession(app);

// ======= CONFIGURATION DE SWAGGER =======
setupSwagger(app);

// ======= ROUTES =======
// Route principale
app.get('/', (req, res) => {
    res.sendFile("index.html", { root: path.join(__dirname, "../../CerisoNet/dist/ceriso-net/browser/") });
});

// Montage des routes
app.use(authRoutes);
app.use(postsRoutes);
app.use(usersRoutes);

// Route générique pour les erreurs serveur
app.get("/error", (req, res) => {
    res.status(500).json({ message: "Erreur serveur" });
});

// ======= CRÉATION DU SERVEUR HTTPS =======
const httpsServer = https.createServer(httpsOptions, app);

// ======= CONFIGURATION DE SOCKET.IO =======
configureSocketIO(httpsServer);

// ======= INITIALISATION DE MONGODB =======
connectToMongoDB().then(() => {

  // ======= DÉMARRAGE DU SERVEUR =======
  httpsServer.listen(PORT_HTTPS, () => {
    console.log(`Serveur HTTPS en écoute sur https://localhost:${PORT_HTTPS}`);
  });
}).catch(err => {
  console.error("Erreur lors de l'initialisation de MongoDB:", err);
  process.exit(1);
});

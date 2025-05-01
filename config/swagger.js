import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API CERISoNet',
      version: '1.0.0',
      description: 'Documentation de l\'API du réseau social CERISoNet',
      contact: {
        name: 'Hugo CHAUTARD',
        email: 'contact@example.com'
      },
    },
    servers: [
      {
        url: 'https://localhost:3221',
        description: 'Serveur de développement HTTPS'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'cerisonet.sid'
        }
      }
    },
    security: [{
      cookieAuth: []
    }]
  },
  apis: [
    './routes/*.js',
    './models/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Fonction pour configurer Swagger dans l'application Express
export const setupSwagger = (app) => {
  // Route pour la documentation Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  
  // Route pour le JSON Swagger
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  console.log('Documentation Swagger disponible sur /api-docs');
};

export default setupSwagger;
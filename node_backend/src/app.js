require('dotenv').config();
const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const { loadConfig } = require('./config');
const { AppError } = require('./utils/errors');
const { logger } = require('./utils/logger');

// Initialize express app
const app = express();
const config = loadConfig(process.env);

const corsOptions = {
  origin: (origin, cb) => {
    // Allow non-browser clients without origin
    if (!origin) return cb(null, true);
    if (config.allowedOrigins.includes('*')) return cb(null, true);
    if (config.allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS origin not allowed'), false);
  },
  methods: config.allowedMethods,
  allowedHeaders: config.allowedHeaders,
  maxAge: config.corsMaxAge,
};

app.use(cors(corsOptions));
app.set('trust proxy', true);
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');           // may or may not include port
  let protocol = req.protocol;          // http or https

  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');
  
  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
     (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
      },
    ],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Parse JSON request body
app.use(express.json());

// Mount routes
app.use('/', routes);

// Error handling middleware (boundary)
app.use((err, req, res, next) => {
  const status = err instanceof AppError ? err.status : 500;
  const payload = {
    status: 'error',
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Internal Server Error',
    details: err.details || null,
  };
  logger.error('request_failed', {
    path: req.path,
    method: req.method,
    status,
    code: payload.code,
    message: payload.message,
  });
  res.status(status).json(payload);
});

module.exports = app;

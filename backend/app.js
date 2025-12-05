import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import riderRoutes from './routes/riderRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import loggingMiddleware from './middleware/loggingMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';
// import promBundle from 'express-prom-bundle';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Prometheus metrics middleware
// const metricsMiddleware = promBundle({
//   includeMethod: true,
//   includePath: true,
//   includeStatusCode: true,
//   includeUp: true,
//   customLabels: { project: 'rapidride' },
//   promClient: {
//     collectDefaultMetrics: {}
//   }
// });

// Apply middleware
// app.use(metricsMiddleware);
app.use(loggingMiddleware);

// Configure CORS to allow requests from your frontend
app.use(cors({
  origin: '*', // In production, specify your frontend URL
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use("/auth", authRoutes);
app.use('/api/rider', riderRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);

// Serve login page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html'));
});

export default app;
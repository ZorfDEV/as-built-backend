import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import routes from './routes/index.js';
import authRoutes from './routes/authRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import errorHandler from './middleware/errorHandler.js';
import reportRoutes from "./routes/reportRoutes.js";
import { apiLimiter, uploadLimiter } from './middleware/rateLimiter.js'; 
import cookieParser from "cookie-parser";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ CORS adapté selon l'environnement
app.use(cookieParser());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/uploads/')) return next();
  apiLimiter(req, res, next);
});
app.use('/api', routes);
app.use('/upload', uploadRoutes);
app.use('/api/report', reportRoutes);

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fiberdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
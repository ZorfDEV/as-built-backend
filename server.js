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
//import observiumRoutes from "./routes/observiumRoutes.js";
//import { startCollector} from "./services/metricsCollector.js";
import reportRoutes from "./routes/reportRoutes.js";
//const reportRoutes = require("./src/routes/reportRoutes");

//startCollector();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
//app.use("/api/report", observiumRoutes);
app.use('/api', routes);
//app.use('/api/report', reportRoutes);
//app.use('/auth', authRoutes);
//app.use('/api/upload', uploadRoutes);
app.use('/upload', uploadRoutes);
app.use("/api/report", reportRoutes);

mongoose.connect('mongodb://localhost:27017/fiberdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT,'0.0.0.0', () => console.log(`Server running on port ${PORT}`));

 
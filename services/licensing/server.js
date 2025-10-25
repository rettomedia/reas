import express from "express";
import dotenv from 'dotenv';
import { sequelize } from './config/db.config.js';
import licenseRoutes from './routes/licenseRouter.js';
import authRoutes from './routes/authRouter.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/licenses', licenseRoutes);
app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.LICENSE_PORT || 3001;

sequelize.sync({ alter: true }).then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
import express from 'express';
import emailRoutes from './routes/email.js';
import logger from './middleware/logger.js';

const app = express();
app.use(express.json());
app.use(logger);

app.use('/', emailRoutes);

const PORT = process.env.MAIL_PORT || 3002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

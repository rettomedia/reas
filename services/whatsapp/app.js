import express from 'express'
import cors from 'cors'

import templateRoutes from './routes/templates.js';
import personaRoutes from './routes/persona.js';
import whatsappRoutes from './routes/whatsapp.js';
import conversationRoutes from './routes/conversations.js';

const app = express();

app.use(cors())
app.use(express.json())

app.use('/api/templates', templateRoutes);
app.use('/api/persona', personaRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/conversations', conversationRoutes);

export default app;
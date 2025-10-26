import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase } from './database.js';
import router from './routes.js';
import { errorHandler } from './middleware.js';

dotenv.config();

const app = express();
const PORT = 3003;

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { success: false, message: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.use('/api/v1', router);

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Email Analyzer API',
        version: '1.0.0',
        endpoints: {
            health: '/api/v1/health',
            auth: {
                login: 'POST /api/v1/auth/login',
                me: 'GET /api/v1/auth/me'
            },
            accounts: {
                create: 'POST /api/v1/accounts',
                list: 'GET /api/v1/accounts',
                delete: 'DELETE /api/v1/accounts/:id'
            },
            emails: {
                fetch: 'POST /api/v1/emails/fetch/:accountId',
                list: 'GET /api/v1/emails/:accountId',
                get: 'GET /api/v1/emails/:accountId/:emailId',
                analyze: 'POST /api/v1/emails/:accountId/:emailId/analyze',
                stats: 'GET /api/v1/stats/:accountId'
            }
        }
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

app.use(errorHandler);

const startServer = async () => {
    try {
        await initDatabase();

        app.listen(PORT, () => {
            console.log('\n🚀 =============================================');
            console.log(`📧 Email Analyzer API Started`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Server: http://localhost:${PORT}`);
            console.log(`📚 API: http://localhost:${PORT}/api/v1`);
            console.log(`💚 Health: http://localhost:${PORT}/api/v1/health`);
            console.log('=============================================\n');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received. Shutting down gracefully...');
    process.exit(0);
});

startServer();
import express from 'express';
import fs from 'fs';
import { getWhatsAppState, getClient, initializeWhatsApp } from '../services/whatsappService.js';

const router = express.Router();
const SESSION_DIR = './.wwebjs_auth';

router.get('/status', (req, res) => {
    const state = getWhatsAppState();
    res.json({
        isReady: state.isReady,
        isAuthenticated: state.isAuthenticated,
        hasQr: !!state.qrCode,
        qrCode: state.qrCode || null,
        hasSession: fs.existsSync(SESSION_DIR),
        isConnecting: state.isConnecting,
        status: state.isReady
            ? 'ready'
            : state.qrCode
                ? 'qr_required'
                : state.isConnecting
                    ? 'connecting'
                    : 'disconnected',
    });
});

router.post('/request-qr', async (req, res) => {
    try {
        const client = getClient();
        if (client) {
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            }
            client.initialize();
            res.json({ status: 'qr_requested', hasSession: false });
        } else {
            res.status(400).json({ error: 'Client not initialized' });
        }
    } catch (error) {
        console.error('QR istek hatası:', error);
        res.status(500).json({ error: 'QR isteği başarısız' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const client = getClient();
        if (client) {
            await client.logout();
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Çıkış hatası:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/restart', async (req, res) => {
    try {
        console.log('🔄 Manuel restart isteği...');
        const client = getClient();
        if (client) {
            await client.destroy();
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            }
        }

        setTimeout(() => {
            initializeWhatsApp();
        }, 1000);

        res.json({ success: true, message: 'Yeniden başlatılıyor' });
    } catch (error) {
        console.error('Restart hatası:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

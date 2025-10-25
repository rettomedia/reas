import express from 'express';
import { connectAndListen, getCachedMails, stopListening } from '../services/imapService.js';

const router = express.Router();

router.post('/email/listen', async (req, res) => {
    const { user, password, host, port, tls } = req.body;

    try {
        await connectAndListen({ user, password, host, port, tls }, (mail) => {
            // Yeni mail geldiğinde cache’e zaten ekleniyor
        });

        res.json({ success: true, message: 'IMAP listener başlatıldı' });
    } catch (err) {
        console.error('❌ IMAP başlatma hatası:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/email/mails', (req, res) => {
    try {
        const mails = getCachedMails();
        res.json({ success: true, mails });
    } catch (err) {
        console.error('❌ Mail listesi alınamadı:', err);
        res.status(500).json({ success: false, message: 'Mail listesi alınamadı' });
    }
});

router.post('/email/stop', (req, res) => {
    stopListening();
    res.json({ success: true, message: 'IMAP listener durduruldu' });
});

export default router;

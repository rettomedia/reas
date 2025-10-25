import express from 'express';
import { getAllConversations, getConversation, deleteConversation, deleteAllConversations } from '../services/conversationService.js';

const router = express.Router();

router.get('/', (req, res) => {
    try {
        res.json(getAllConversations());
    } catch (error) {
        console.error('❌ Konuşma geçmişi getirme hatası:', error);
        res.status(500).json({ error: 'Konuşma geçmişi alınamadı' });
    }
});

router.get('/:phone', (req, res) => {
    try {
        const conversation = getConversation(req.params.phone);
        if (!conversation) {
            return res.status(404).json({ error: 'Konuşma bulunamadı' });
        }
        res.json(conversation);
    } catch (error) {
        console.error('❌ Konuşma detayı getirme hatası:', error);
        res.status(500).json({ error: 'Konuşma detayı alınamadı' });
    }
});

router.delete('/:phone', (req, res) => {
    try {
        deleteConversation(req.params.phone);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Konuşma silme hatası:', error);
        res.status(500).json({ error: 'Konuşma silinemedi' });
    }
});

router.delete('/', (req, res) => {
    try {
        deleteAllConversations();
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Tüm konuşmaları silme hatası:', error);
        res.status(500).json({ error: 'Konuşmalar silinemedi' });
    }
});

export default router;

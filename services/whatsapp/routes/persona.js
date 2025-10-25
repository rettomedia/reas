import express from 'express';
import { getPersona, updatePersona } from '../services/personaService.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json(getPersona());
});

router.post('/', (req, res) => {
    try {
        updatePersona(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Persona güncellenemedi' });
    }
});

export default router;

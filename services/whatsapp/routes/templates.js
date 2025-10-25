import express from 'express';
import { getTemplates, addTemplate, deleteTemplate } from '../services/templateService.js';

const router = express.Router();

router.get('/', (req, res) => res.json(getTemplates()));
router.post('/', (req, res) => {
    const { trigger, reply } = req.body;
    res.json(addTemplate(trigger, reply));
});
router.delete('/:index', (req, res) => res.json(deleteTemplate(req.params.index)));

export default router;
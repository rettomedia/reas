import express from 'express';
import * as LicenseController from '../controllers/licenseController.js';
import { adminAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', adminAuth, LicenseController.getLicenses);
router.get('/check/:id', LicenseController.checkLicense);
router.post('/', adminAuth, LicenseController.createLicense);
router.delete('/:id', adminAuth, LicenseController.deleteLicense);

export default router;
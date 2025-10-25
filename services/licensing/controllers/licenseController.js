import * as LicenseService from '../services/licenseService.js';

export const getLicenses = async (req, res, next) => {
    try {
        const licenses = await LicenseService.getAllLicenses();
        res.json(licenses || []);
    } catch (err) {
        next(err);
    }
};

export const checkLicense = async (req, res, next) => {
    try {
        const active = await LicenseService.checkLicense(req.params.id);
        res.json({ active });
    } catch (err) {
        next(err);
    }
};

export const createLicense = async (req, res, next) => {
    try {
        const license = await LicenseService.createLicense(req.body);
        res.status(201).json(license);
    } catch (err) {
        next(err);
    }
};

export const deleteLicense = async (req, res, next) => {
    try {
        await LicenseService.deleteLicense(req.params.id);
        res.json({ message: 'License deleted' });
    } catch (err) {
        next(err);
    }
};
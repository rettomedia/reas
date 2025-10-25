import { License } from '../models/License.js';

export const getAllLicenses = async () => {
    return License.findAll();
};

export const checkLicense = async (id) => {
    const license = await License.findByPk(id);
    if (!license) throw new Error('License not found');
    return license.active;
};

export const createLicense = async (data) => {
    return License.create(data);
};

export const deleteLicense = async (id) => {
    const license = await License.findByPk(id);
    if (!license) throw new Error('License not found');
    return license.destroy();
};
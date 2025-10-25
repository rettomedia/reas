import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.config.js';

export const License = sequelize.define('License', {
    code: { type: DataTypes.STRING, unique: true, allowNull: false },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    owner: { type: DataTypes.STRING, allowNull: true },
});
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.config.js';

export const User = sequelize.define('User', {
    username: {type: DataTypes.STRING, unique: true, allowNull: false},
    password: {type: DataTypes.STRING, allowNull: false},
    isAdmin: {type: DataTypes.BOOLEAN, defaultValue: false},
});
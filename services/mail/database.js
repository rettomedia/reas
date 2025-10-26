import { Sequelize, DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_PATH || './mail.sqlite',
    logging: false
});

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret', 'salt', 32);

export const encrypt = (text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted,
        tag: authTag.toString('hex')
    });
};

export const decrypt = (encryptedText) => {
    const { iv, data, tag } = JSON.parse(encryptedText);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

export const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    hooks: {
        beforeSave: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    }
});

User.prototype.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password;
    return values;
};

export const ImapAccount = sequelize.define('ImapAccount', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isEmail: true }
    },
    imapHost: {
        type: DataTypes.STRING,
        allowNull: false
    },
    imapPort: {
        type: DataTypes.INTEGER,
        defaultValue: 993
    },
    imapTls: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    encryptedPassword: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    displayName: DataTypes.STRING,
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lastSync: DataTypes.DATE
}, {
    hooks: {
        beforeSave: async (account) => {
            if (account.changed('encryptedPassword') && !account.encryptedPassword.includes('{')) {
                account.encryptedPassword = encrypt(account.encryptedPassword);
            }
        }
    }
});

ImapAccount.prototype.getPassword = function() {
    return decrypt(this.encryptedPassword);
};

ImapAccount.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.encryptedPassword;
    return values;
};

export const Email = sequelize.define('Email', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    imapAccountId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    uid: DataTypes.INTEGER,
    from: {
        type: DataTypes.STRING,
        allowNull: false
    },
    to: DataTypes.TEXT,
    subject: DataTypes.STRING,
    date: DataTypes.DATE,
    body: DataTypes.TEXT,
    html: DataTypes.TEXT,
    attachments: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    category: {
        type: DataTypes.ENUM('customer', 'normal', 'spam', 'promotional', 'unknown'),
        defaultValue: 'unknown'
    },
    trustScore: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    sentimentScore: DataTypes.FLOAT,
    urgencyScore: DataTypes.FLOAT,
    professionalismScore: DataTypes.FLOAT,
    spamIndicators: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    phishingIndicators: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    keyPhrases: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    isAnalyzed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    indexes: [
        { fields: ['imapAccountId'] },
        { fields: ['category'] },
        { fields: ['trustScore'] }
    ]
});

User.hasMany(ImapAccount, { foreignKey: 'userId', as: 'accounts', onDelete: 'CASCADE' });
ImapAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

ImapAccount.hasMany(Email, { foreignKey: 'imapAccountId', as: 'emails', onDelete: 'CASCADE' });
Email.belongsTo(ImapAccount, { foreignKey: 'imapAccountId', as: 'account' });

export const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');
        await sequelize.sync({ alter: true });
        console.log('✅ Database synchronized');
    } catch (error) {
        console.error('❌ Database error:', error);
        throw error;
    }
};

if (import.meta.url === `file://${process.argv[1]}`) {
    await initDatabase();
    process.exit(0);
}
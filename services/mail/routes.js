import express from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, ImapAccount, Email, sequelize } from './database.js';
import { ImapService, AnalyzerService } from './services.js';
import { authenticate, validate, sendResponse } from './middleware.js';

const router = express.Router();

router.get('/health', (req, res) => {
    sendResponse(res, 200, true, 'API is running', {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        status: 'healthy'
    });
});

router.post('/auth/login',
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    validate,
    async (req, res, next) => {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ where: { email, isActive: true } });

            if (!user) {
                return sendResponse(res, 401, false, 'Invalid email or password');
            }

            const isValidPassword = await user.comparePassword(password);
            if (!isValidPassword) {
                return sendResponse(res, 401, false, 'Invalid email or password');
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '7d' }
            );

            sendResponse(res, 200, true, 'Login successful', {
                user: user.toJSON(),
                token
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/auth/me', authenticate, async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [{
                model: ImapAccount,
                as: 'accounts',
                attributes: { exclude: ['encryptedPassword'] }
            }]
        });

        if (!user) {
            return sendResponse(res, 404, false, 'User not found');
        }

        sendResponse(res, 200, true, 'User retrieved successfully', user);
    } catch (error) {
        next(error);
    }
});


router.post('/accounts',
    authenticate,
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    body('imapHost').notEmpty().withMessage('IMAP host required'),
    body('imapPort').isInt({ min: 1, max: 65535 }).withMessage('Valid port required'),
    validate,
    async (req, res, next) => {
        try {
            const { email, password, imapHost, imapPort, imapTls, displayName } = req.body;

            try {
                await ImapService.testConnection({
                    email,
                    password,
                    host: imapHost,
                    port: imapPort || 993,
                    tls: imapTls !== false
                });
            } catch (error) {
                return sendResponse(res, 400, false, 'IMAP connection failed', {
                    error: error.message
                });
            }

            const account = await ImapAccount.create({
                userId: req.user.id,
                email,
                encryptedPassword: password,
                imapHost,
                imapPort: imapPort || 993,
                imapTls: imapTls !== false,
                displayName: displayName || email
            });

            sendResponse(res, 201, true, 'IMAP account added successfully', account);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/accounts', authenticate, async (req, res, next) => {
    try {
        const accounts = await ImapAccount.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        sendResponse(res, 200, true, 'Accounts retrieved successfully', accounts);
    } catch (error) {
        next(error);
    }
});

router.get('/accounts/:id', authenticate, async (req, res, next) => {
    try {
        const account = await ImapAccount.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!account) {
            return sendResponse(res, 404, false, 'Account not found');
        }

        sendResponse(res, 200, true, 'Account retrieved successfully', account);
    } catch (error) {
        next(error);
    }
});

router.put('/accounts/:id',
    authenticate,
    body('displayName').optional().notEmpty(),
    body('isActive').optional().isBoolean(),
    validate,
    async (req, res, next) => {
        try {
            const account = await ImapAccount.findOne({
                where: { id: req.params.id, userId: req.user.id }
            });

            if (!account) {
                return sendResponse(res, 404, false, 'Account not found');
            }

            const { displayName, isActive } = req.body;
            await account.update({ displayName, isActive });

            sendResponse(res, 200, true, 'Account updated successfully', account);
        } catch (error) {
            next(error);
        }
    }
);

router.delete('/accounts/:id', authenticate, async (req, res, next) => {
    try {
        const account = await ImapAccount.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!account) {
            return sendResponse(res, 404, false, 'Account not found');
        }

        await account.destroy();
        sendResponse(res, 200, true, 'Account deleted successfully');
    } catch (error) {
        next(error);
    }
});

router.post('/emails/fetch/:accountId',
    authenticate,
    body('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1-500'),
    body('mailbox').optional().isString(),
    validate,
    async (req, res, next) => {
        try {
            const { accountId } = req.params;
            const { limit = 50, mailbox = 'INBOX' } = req.body;

            const account = await ImapAccount.findOne({
                where: { id: accountId, userId: req.user.id, isActive: true }
            });

            if (!account) {
                return sendResponse(res, 404, false, 'Account not found or inactive');
            }

            const emails = await ImapService.fetchEmails({
                email: account.email,
                password: account.getPassword(),
                host: account.imapHost,
                port: account.imapPort,
                tls: account.imapTls
            }, { limit, mailbox });

            if (emails.length === 0) {
                return sendResponse(res, 200, true, 'No new emails found', {
                    total: 0,
                    new: 0,
                    emails: []
                });
            }

            const savedEmails = [];
            let skippedCount = 0;

            for (const emailData of emails) {
                const existing = await Email.findOne({
                    where: { messageId: emailData.messageId }
                });

                if (existing) {
                    skippedCount++;
                    continue;
                }

                const analysis = AnalyzerService.analyzeEmail(emailData);

                const email = await Email.create({
                    imapAccountId: accountId,
                    messageId: emailData.messageId,
                    uid: emailData.uid,
                    from: emailData.from,
                    to: emailData.to,
                    subject: emailData.subject,
                    date: emailData.date,
                    body: emailData.body,
                    html: emailData.html,
                    attachments: emailData.attachments,
                    category: analysis.category,
                    trustScore: analysis.trustScore,
                    sentimentScore: analysis.sentimentScore,
                    urgencyScore: analysis.urgencyScore,
                    professionalismScore: analysis.professionalismScore,
                    spamIndicators: analysis.spamIndicators,
                    phishingIndicators: analysis.phishingIndicators,
                    keyPhrases: analysis.keyPhrases,
                    isAnalyzed: true
                });

                savedEmails.push(email);
            }

            await account.update({ lastSync: new Date() });

            sendResponse(res, 200, true, `Fetched and analyzed emails successfully`, {
                total: emails.length,
                new: savedEmails.length,
                skipped: skippedCount,
                emails: savedEmails
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/emails/:accountId',
    authenticate,
    async (req, res, next) => {
        try {
            const { accountId } = req.params;
            const {
                category,
                minTrustScore,
                maxTrustScore,
                limit = 100,
                offset = 0,
                sortBy = 'date',
                sortOrder = 'DESC'
            } = req.query;

            const account = await ImapAccount.findOne({
                where: { id: accountId, userId: req.user.id }
            });

            if (!account) {
                return sendResponse(res, 404, false, 'Account not found');
            }

            const where = { imapAccountId: accountId };

            if (category) {
                where.category = category;
            }

            if (minTrustScore) {
                where.trustScore = { [Op.gte]: parseFloat(minTrustScore) };
            }

            if (maxTrustScore) {
                if (where.trustScore) {
                    where.trustScore[Op.lte] = parseFloat(maxTrustScore);
                } else {
                    where.trustScore = { [Op.lte]: parseFloat(maxTrustScore) };
                }
            }

            const emails = await Email.findAll({
                where,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [[sortBy, sortOrder]],
                attributes: { exclude: ['html', 'body'] }
            });

            const total = await Email.count({ where });

            sendResponse(res, 200, true, 'Emails retrieved successfully', {
                emails,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/emails/:accountId/:emailId',
    authenticate,
    async (req, res, next) => {
        try {
            const { accountId, emailId } = req.params;

            const account = await ImapAccount.findOne({
                where: { id: accountId, userId: req.user.id }
            });

            if (!account) {
                return sendResponse(res, 404, false, 'Account not found');
            }

            const email = await Email.findOne({
                where: { id: emailId, imapAccountId: accountId }
            });

            if (!email) {
                return sendResponse(res, 404, false, 'Email not found');
            }

            sendResponse(res, 200, true, 'Email retrieved successfully', email);
        } catch (error) {
            next(error);
        }
    }
);

router.post('/emails/:accountId/:emailId/analyze',
    authenticate,
    async (req, res, next) => {
        try {
            const { accountId, emailId } = req.params;

            const account = await ImapAccount.findOne({
                where: { id: accountId, userId: req.user.id }
            });

            if (!account) {
                return sendResponse(res, 404, false, 'Account not found');
            }

            const email = await Email.findOne({
                where: { id: emailId, imapAccountId: accountId }
            });

            if (!email) {
                return sendResponse(res, 404, false, 'Email not found');
            }

            const analysis = AnalyzerService.analyzeEmail({
                subject: email.subject,
                body: email.body,
                from: email.from
            });

            await email.update({
                category: analysis.category,
                trustScore: analysis.trustScore,
                sentimentScore: analysis.sentimentScore,
                urgencyScore: analysis.urgencyScore,
                professionalismScore: analysis.professionalismScore,
                spamIndicators: analysis.spamIndicators,
                phishingIndicators: analysis.phishingIndicators,
                keyPhrases: analysis.keyPhrases,
                isAnalyzed: true
            });

            sendResponse(res, 200, true, 'Email re-analyzed successfully', email);
        } catch (error) {
            next(error);
        }
    }
);

router.delete('/emails/:accountId/:emailId',
    authenticate,
    async (req, res, next) => {
        try {
            const { accountId, emailId } = req.params;

            const account = await ImapAccount.findOne({
                where: { id: accountId, userId: req.user.id }
            });

            if (!account) {
                return sendResponse(res, 404, false, 'Account not found');
            }

            const email = await Email.findOne({
                where: { id: emailId, imapAccountId: accountId }
            });

            if (!email) {
                return sendResponse(res, 404, false, 'Email not found');
            }

            await email.destroy();
            sendResponse(res, 200, true, 'Email deleted successfully');
        } catch (error) {
            next(error);
        }
    }
);

router.get('/stats/:accountId',
    authenticate,
    async (req, res, next) => {
        try {
            const { accountId } = req.params;

            const account = await ImapAccount.findOne({
                where: { id: accountId, userId: req.user.id }
            });

            if (!account) {
                return sendResponse(res, 404, false, 'Account not found');
            }

            const total = await Email.count({
                where: { imapAccountId: accountId }
            });

            const customer = await Email.count({
                where: { imapAccountId: accountId, category: 'customer' }
            });

            const spam = await Email.count({
                where: { imapAccountId: accountId, category: 'spam' }
            });

            const normal = await Email.count({
                where: { imapAccountId: accountId, category: 'normal' }
            });

            const promotional = await Email.count({
                where: { imapAccountId: accountId, category: 'promotional' }
            });

            const avgTrustScore = await Email.findOne({
                where: { imapAccountId: accountId },
                attributes: [
                    [sequelize.fn('AVG', sequelize.col('trustScore')), 'avgTrust']
                ],
                raw: true
            });

            const avgSentiment = await Email.findOne({
                where: { imapAccountId: accountId },
                attributes: [
                    [sequelize.fn('AVG', sequelize.col('sentimentScore')), 'avgSentiment']
                ],
                raw: true
            });

            sendResponse(res, 200, true, 'Statistics retrieved successfully', {
                total,
                categories: {
                    customer,
                    spam,
                    normal,
                    promotional,
                    unknown: total - customer - spam - normal - promotional
                },
                averages: {
                    trustScore: parseFloat(avgTrustScore?.avgTrust || 0).toFixed(2),
                    sentimentScore: parseFloat(avgSentiment?.avgSentiment || 0).toFixed(2)
                },
                lastSync: account.lastSync
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/stats',
    authenticate,
    async (req, res, next) => {
        try {
            const accounts = await ImapAccount.findAll({
                where: { userId: req.user.id }
            });

            const accountIds = accounts.map(acc => acc.id);

            if (accountIds.length === 0) {
                return sendResponse(res, 200, true, 'No accounts found', {
                    totalAccounts: 0,
                    totalEmails: 0
                });
            }

            const total = await Email.count({
                where: { imapAccountId: { [Op.in]: accountIds } }
            });

            const customer = await Email.count({
                where: {
                    imapAccountId: { [Op.in]: accountIds },
                    category: 'customer'
                }
            });

            const spam = await Email.count({
                where: {
                    imapAccountId: { [Op.in]: accountIds },
                    category: 'spam'
                }
            });

            sendResponse(res, 200, true, 'Overall statistics retrieved', {
                totalAccounts: accounts.length,
                totalEmails: total,
                customerEmails: customer,
                spamEmails: spam,
                accounts: accounts.map(acc => ({
                    id: acc.id,
                    email: acc.email,
                    displayName: acc.displayName,
                    lastSync: acc.lastSync
                }))
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
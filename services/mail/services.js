import Imap from 'imap';
import { simpleParser } from 'mailparser';
import natural from 'natural';
import Sentiment from 'sentiment';

const sentiment = new Sentiment();
const tokenizer = new natural.WordTokenizer();

export class ImapService {
    static createConnection(config) {
        return new Imap({
            user: config.email,
            password: config.password,
            host: config.host,
            port: config.port,
            tls: config.tls,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000
        });
    }

    static async testConnection(config) {
        return new Promise((resolve, reject) => {
            const imap = this.createConnection(config);
            imap.once('ready', () => {
                imap.end();
                resolve(true);
            });
            imap.once('error', reject);
            imap.connect();
        });
    }

    static async fetchEmails(config, options = {}) {
        const { mailbox = 'INBOX', limit = 50 } = options;

        return new Promise((resolve, reject) => {
            const imap = this.createConnection(config);
            const emails = [];

            imap.once('ready', () => {
                imap.openBox(mailbox, true, (err, box) => {
                    if (err) {
                        imap.end();
                        return reject(err);
                    }

                    imap.search(['ALL'], (err, results) => {
                        if (err || !results || results.length === 0) {
                            imap.end();
                            return err ? reject(err) : resolve([]);
                        }

                        const emailsToFetch = results.slice(-limit);
                        const fetch = imap.fetch(emailsToFetch, { bodies: '', struct: true });

                        fetch.on('message', (msg, seqno) => {
                            let buffer = '';
                            let uid = null;

                            msg.on('body', (stream) => {
                                stream.on('data', (chunk) => {
                                    buffer += chunk.toString('utf8');
                                });
                            });

                            msg.once('attributes', (attrs) => {
                                uid = attrs.uid;
                            });

                            msg.once('end', async () => {
                                try {
                                    const parsed = await simpleParser(buffer);
                                    emails.push({
                                        uid,
                                        messageId: parsed.messageId,
                                        from: parsed.from?.text || '',
                                        to: parsed.to?.text || '',
                                        subject: parsed.subject || '',
                                        date: parsed.date || new Date(),
                                        body: parsed.text || '',
                                        html: parsed.html || '',
                                        attachments: parsed.attachments?.map(att => ({
                                            filename: att.filename,
                                            contentType: att.contentType,
                                            size: att.size
                                        })) || []
                                    });
                                } catch (e) {
                                    console.error('Parse error:', e);
                                }
                            });
                        });

                        fetch.once('error', (err) => {
                            imap.end();
                            reject(err);
                        });

                        fetch.once('end', () => {
                            imap.end();
                            resolve(emails);
                        });
                    });
                });
            });

            imap.once('error', reject);
            imap.connect();
        });
    }
}

export class AnalyzerService {
    static SPAM_KEYWORDS = [
        'free', 'click here', 'urgent', 'winner', 'congratulations', 'prize',
        'cash', 'bonus', 'discount', 'limited time', 'act now', 'buy now',
        'credit card', 'guarantee', 'risk-free', 'no obligation'
    ];

    static CUSTOMER_KEYWORDS = [
        'order', 'purchase', 'invoice', 'receipt', 'payment', 'product',
        'service', 'subscription', 'account', 'delivery', 'shipping',
        'refund', 'return', 'support', 'help', 'question', 'issue'
    ];

    static PHISHING_PATTERNS = [
        /verify.{0,20}account/i,
        /suspend.{0,20}account/i,
        /confirm.{0,20}identity/i,
        /update.{0,20}payment/i,
        /click.{0,20}link/i,
        /urgent.{0,20}action/i
    ];

    static analyzeEmail(email) {
        const text = `${email.subject || ''} ${email.body || ''}`.toLowerCase();

        const sentimentResult = sentiment.analyze(text);
        const sentimentScore = sentimentResult.score;

        const spamIndicators = this.detectSpam(text);

        const phishingIndicators = this.detectPhishing(text, email);

        const customerScore = this.calculateCustomerScore(text);

        const professionalismScore = this.analyzeProfessionalism(text);

        const urgencyScore = this.analyzeUrgency(text);

        const trustScore = this.calculateTrustScore({
            spam: spamIndicators.length,
            phishing: phishingIndicators.length,
            professionalism: professionalismScore,
            customer: customerScore
        });

        const category = this.determineCategory({
            customerScore,
            spamCount: spamIndicators.length,
            phishingCount: phishingIndicators.length,
            trustScore
        });

        const keyPhrases = this.extractKeyPhrases(text);

        return {
            category,
            trustScore: Math.round(trustScore * 10) / 10,
            sentimentScore: Math.round(sentimentScore * 10) / 10,
            urgencyScore: Math.round(urgencyScore * 10) / 10,
            professionalismScore: Math.round(professionalismScore * 10) / 10,
            spamIndicators,
            phishingIndicators,
            keyPhrases
        };
    }

    static detectSpam(text) {
        const indicators = [];

        this.SPAM_KEYWORDS.forEach(keyword => {
            if (text.includes(keyword)) {
                indicators.push(keyword);
            }
        });

        const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
        if (capsRatio > 0.3) {
            indicators.push('excessive_caps');
        }

        const exclamationCount = (text.match(/!/g) || []).length;
        if (exclamationCount > 3) {
            indicators.push('excessive_exclamation');
        }

        return indicators;
    }

    static detectPhishing(text, email) {
        const indicators = [];

        this.PHISHING_PATTERNS.forEach((pattern, index) => {
            if (pattern.test(text)) {
                indicators.push(`phishing_pattern_${index + 1}`);
            }
        });

        const urlMatches = text.match(/https?:\/\/[^\s]+/gi) || [];
        if (urlMatches.length > 5) {
            indicators.push('excessive_links');
        }

        if (email.from && email.from.includes('@')) {
            const domain = email.from.split('@')[1];
            if (domain && !domain.match(/\.(com|org|net|edu|gov)$/i)) {
                indicators.push('suspicious_domain');
            }
        }

        return indicators;
    }

    static calculateCustomerScore(text) {
        let score = 0;
        this.CUSTOMER_KEYWORDS.forEach(keyword => {
            if (text.includes(keyword)) {
                score += 0.1;
            }
        });
        return Math.min(score, 1);
    }

    static analyzeProfessionalism(text) {
        let score = 5;

        const sentences = text.split(/[.!?]+/);
        const avgLength = sentences.reduce((sum, s) => sum + s.trim().length, 0) / sentences.length;

        if (avgLength > 50 && avgLength < 200) score += 2;

        const properCaps = sentences.filter(s => s.trim().match(/^[A-Z]/)).length / sentences.length;
        if (properCaps > 0.7) score += 2;

        if (!text.match(/[!?]{2,}/)) score += 1;

        return Math.min(score, 10);
    }

    static analyzeUrgency(text) {
        const urgentWords = ['urgent', 'immediately', 'asap', 'now', 'hurry', 'quick', 'fast', 'expire'];
        let score = 0;

        urgentWords.forEach(word => {
            const matches = text.match(new RegExp(word, 'gi'));
            if (matches) score += matches.length;
        });

        return Math.min(score, 10);
    }

    static calculateTrustScore({ spam, phishing, professionalism, customer }) {
        let score = 100;

        score -= spam * 5;

        score -= phishing * 15;

        score += (professionalism - 5) * 2;

        score += customer * 10;

        return Math.max(0, Math.min(100, score));
    }

    static determineCategory({ customerScore, spamCount, phishingCount, trustScore }) {
        if (phishingCount > 0 || trustScore < 30) return 'spam';
        if (spamCount > 3 && trustScore < 50) return 'spam';
        if (customerScore > 0.3) return 'customer';
        if (spamCount > 5) return 'promotional';
        return 'normal';
    }

    static extractKeyPhrases(text) {
        const tokens = tokenizer.tokenize(text.toLowerCase());
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);

        const filtered = tokens.filter(token =>
            token.length > 3 && !stopWords.has(token) && /^[a-z]+$/.test(token)
        );

        const freq = {};
        filtered.forEach(token => {
            freq[token] = (freq[token] || 0) + 1;
        });

        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }
}
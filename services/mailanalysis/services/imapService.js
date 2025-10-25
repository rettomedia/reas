import imap from 'imap';
import { simpleParser } from 'mailparser';

let cachedMails = [];
let connectionInstance = null;
const CACHE_LIMIT = 200;

export function getCachedMails() {
    return cachedMails;
}

export function stopListening() {
    if (connectionInstance) {
        connectionInstance.end();
        connectionInstance = null;
    }
}

function simplifyMail(mail) {
    const preview = mail.text ? mail.text.replace(/\r?\n/g, ' ').slice(0, 200) + (mail.text.length > 200 ? '...' : '') : '';

    return {
        from: mail.from?.text || '',
        to: mail.to?.text || '',
        subject: mail.subject || '',
        date: mail.date || '',
        preview,
        attachments: mail.attachments?.map(att => ({
            filename: att.filename,
            size: att.size,
            contentType: att.contentType
        })) || []
    };
}


export function connectAndListen(config, onNewMail) {
    return new Promise((resolve, reject) => {
        connectionInstance = new imap({
            user: config.user,
            password: config.password,
            host: config.host,
            port: config.port || 993,
            tls: config.tls !== false,
            tlsOptions: { rejectUnauthorized: false }
        });

        connectionInstance.once('ready', () => {
            connectionInstance.openBox('INBOX', true, (err, box) => {
                if (err) return reject(err);
                console.log(`📂 INBOX açıldı, toplam mesaj sayısı: ${box.messages.total}`);

                const fetcher = connectionInstance.seq.fetch('1:*', { bodies: '' });
                fetcher.on('message', (msg) => {
                    let raw = '';
                    msg.on('body', (stream) => {
                        stream.on('data', (chunk) => raw += chunk.toString('utf8'));
                    });
                    msg.once('end', async () => {
                        try {
                            const mail = await simpleParser(raw);
                            const simpleMail = simplifyMail(mail);

                            if (cachedMails.length >= CACHE_LIMIT) cachedMails.shift();
                            cachedMails.push(simpleMail);

                            onNewMail(simpleMail);
                            console.log(`📧 Mail alındı: ${simpleMail.subject}`);
                        } catch (err) {
                            console.error('❌ Mail parse hatası:', err);
                        }
                    });
                });

                fetcher.once('error', (err) => console.error('❌ Fetch hatası:', err));
                fetcher.once('end', () => console.log('📬 Mevcut mailler fetch tamamlandı'));

                resolve(connectionInstance);
            });
        });

        connectionInstance.once('error', (err) => reject(err));
        connectionInstance.connect();
    });
}

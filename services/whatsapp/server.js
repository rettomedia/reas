import 'dotenv/config';
import Groq from "groq-sdk";
import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode-terminal';
import { Server } from 'socket.io';
import http from 'http';
import fs from 'fs';

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(cors({ origin: 'http://localhost:8000' }));
app.use(express.json());

const TEMPLATES_FILE = './templates.json';
const PERSONA_FILE = './persona.json';

let templates = [];
if (fs.existsSync(TEMPLATES_FILE)) templates = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
const saveTemplates = () => fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));

let persona = { brand: "XYZ Şirketi", address: "Örnek Mah. 123, İstanbul", tone: "Samimi, kısa ve anlaşılır", extra_instructions: "Asla spam yapma, her zaman yardımcı ol." };
if (fs.existsSync(PERSONA_FILE)) persona = JSON.parse(fs.readFileSync(PERSONA_FILE, 'utf-8'));
const savePersona = () => fs.writeFileSync(PERSONA_FILE, JSON.stringify(persona, null, 2));

const messageHistory = {};

const SESSION_DIR = './.wwebjs_auth';

let whatsappState = {
    isReady: false,
    isAuthenticated: false,
    qrCode: null,
    isConnecting: false
};

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: SESSION_DIR,
        clientId: "whatsapp-assistant"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    },
});

let qrCode = null;

const checkExistingSession = async () => {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            const sessionFiles = fs.readdirSync(SESSION_DIR);
            const hasSession = sessionFiles.some(file =>
                file.includes('session') || file.includes('LocalAuth')
            );
            console.log('📁 Mevcut session bulundu:', hasSession);
            return hasSession;
        }
        return false;
    } catch (error) {
        console.log('❌ Session kontrol hatası:', error);
        return false;
    }
};

client.on('qr', (qr) => {
    qrCode = qr;
    whatsappState.qrCode = qr;
    whatsappState.isReady = false;
    whatsappState.isAuthenticated = false;
    console.log('QR oluşturuldu');
    io.emit('qr', qr);
    io.emit('whatsapp_status', {
        status: 'qr_required',
        hasSession: false,
        isReady: false
    });
});

client.on('authenticated', () => {
    whatsappState.isAuthenticated = true;
    whatsappState.isConnecting = false;
    console.log('✅ WhatsApp doğrulandı');
    io.emit('authenticated');
    io.emit('whatsapp_status', {
        status: 'authenticated',
        hasSession: true,
        isReady: false
    });
});

client.on('ready', () => {
    qrCode = null;
    whatsappState.isReady = true;
    whatsappState.isAuthenticated = true;
    whatsappState.qrCode = null;
    whatsappState.isConnecting = false;
    console.log('✅ WhatsApp bağlı');
    io.emit('ready');
    io.emit('whatsapp_status', {
        status: 'ready',
        hasSession: true,
        isReady: true
    });
});

client.on('disconnected', (reason) => {
    whatsappState.isReady = false;
    whatsappState.isAuthenticated = false;
    whatsappState.isConnecting = false;
    console.log('⚠️ Bağlantı koptu:', reason);
    io.emit('disconnected', reason);
    io.emit('whatsapp_status', {
        status: 'disconnected',
        hasSession: false,
        isReady: false
    });

    setTimeout(() => {
        console.log('🔄 Otomatik yeniden bağlanılıyor...');
        initializeWhatsApp();
    }, 5000);
});

client.on('loading_screen', (percent, message) => {
    console.log(`🔄 Yükleniyor: ${percent}% - ${message}`);
    io.emit('loading_screen', `${percent}% - ${message}`);
    io.emit('whatsapp_status', {
        status: 'loading',
        hasSession: true,
        isReady: false,
        progress: percent
    });
});

const initializeWhatsApp = async () => {
    try {
        whatsappState.isConnecting = true;
        const hasSession = await checkExistingSession();

        if (hasSession) {
            console.log('🔄 Mevcut session ile başlatılıyor...');
            io.emit('whatsapp_status', {
                status: 'restoring_session',
                hasSession: true,
                isReady: false
            });
        } else {
            console.log('🆕 Yeni session başlatılıyor...');
            io.emit('whatsapp_status', {
                status: 'new_session',
                hasSession: false,
                isReady: false
            });
        }

        await client.initialize();
    } catch (error) {
        console.error('❌ WhatsApp başlatma hatası:', error);
        whatsappState.isConnecting = false;
        io.emit('whatsapp_status', {
            status: 'error',
            hasSession: false,
            isReady: false,
            error: error.message
        });
    }
};

setTimeout(() => {
    initializeWhatsApp();
}, 2000);

client.on('message', async (message) => {
    const from = message.from;

    try {
        const match = templates.find(t =>
            message.body.toLowerCase().includes(t.trigger.toLowerCase())
        );
        if (match) {
            await client.sendMessage(from, match.reply);
            if (!messageHistory[from]) messageHistory[from] = [];
            messageHistory[from].push({ role: 'user', content: message.body });
            messageHistory[from].push({ role: 'assistant', content: match.reply });
            io.emit('message', { from, body: message.body, reply: match.reply });
            return;
        }

        console.log(`💬 Yeni mesaj: ${message.body}`);

        if (!messageHistory[from]) messageHistory[from] = [];
        messageHistory[from].push({ role: 'user', content: message.body });
        if (messageHistory[from].length > 20) messageHistory[from].shift();

        const systemPrompt = `
Sen ${persona.brand} markasının resmi WhatsApp asistanısın.
Adres: ${persona.address}
Tarz: ${persona.tone}
${persona.extra_instructions}
`;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                ...messageHistory[from]
            ],
        });

        const aiReply = completion.choices[0]?.message?.content || "Anlayamadım 😅";

        await client.sendMessage(from, aiReply);

        messageHistory[from].push({ role: 'assistant', content: aiReply });
        if (messageHistory[from].length > 20) messageHistory[from].shift();

        io.emit('message', { from, body: message.body, reply: aiReply });

    } catch (err) {
        console.error('❌ Groq AI hata:', err);
        await client.sendMessage(from, "AI servisine şu anda ulaşılamıyor. Daha sonra tekrar deneyin.");
    }
});

app.get('/api/templates', (req, res) => res.json(templates));

app.post('/api/templates', (req, res) => {
    const { trigger, reply } = req.body;
    if (!trigger || !reply) {
        return res.status(400).json({ error: 'Trigger ve reply gereklidir' });
    }
    templates.push({ trigger, reply });
    saveTemplates();
    res.json({ success: true });
});

app.delete('/api/templates/:index', (req, res) => {
    const { index } = req.params;
    if (index < 0 || index >= templates.length) {
        return res.status(404).json({ error: 'Şablon bulunamadı' });
    }
    templates.splice(index, 1);
    saveTemplates();
    res.json({ success: true });
});

app.get('/api/persona', (req, res) => res.json(persona));

app.post('/api/persona', (req, res) => {
    persona = req.body;
    savePersona();
    res.json({ success: true });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: client.ready ? 'connected' : 'disconnected',
        qr: !!qrCode,
        hasSession: fs.existsSync(SESSION_DIR),
        state: whatsappState
    });
});

app.get('/api/whatsapp-status', (req, res) => {
    res.json({
        isReady: whatsappState.isReady,
        isAuthenticated: whatsappState.isAuthenticated,
        hasQr: !!whatsappState.qrCode,
        hasSession: fs.existsSync(SESSION_DIR),
        isConnecting: whatsappState.isConnecting,
        status: whatsappState.isReady ? 'ready' :
            whatsappState.qrCode ? 'qr_required' :
                whatsappState.isConnecting ? 'connecting' : 'disconnected'
    });
});

app.post('/api/request-qr', (req, res) => {
    try {
        if (client) {
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            }
            client.initialize();
            res.json({ status: 'qr_requested', hasSession: false });
        } else {
            res.status(400).json({ error: 'Client not initialized' });
        }
    } catch (error) {
        console.error('QR istek hatası:', error);
        res.status(500).json({ error: 'QR isteği başarısız' });
    }
});


app.get('/api/conversations', (req, res) => {
    try {
        const conversations = {};

        Object.keys(messageHistory).forEach(phone => {
            conversations[phone] = {
                phone: phone,
                lastMessage: messageHistory[phone][messageHistory[phone].length - 1]?.content || '',
                lastMessageTime: new Date().toISOString(),
                messageCount: messageHistory[phone].length,
                history: messageHistory[phone]
            };
        });

        res.json(conversations);
    } catch (error) {
        console.error('❌ Konuşma geçmişi getirme hatası:', error);
        res.status(500).json({ error: 'Konuşma geçmişi alınamadı' });
    }
});

app.get('/api/conversations/:phone', (req, res) => {
    try {
        const { phone } = req.params;
        const conversation = messageHistory[phone];

        if (!conversation) {
            return res.status(404).json({ error: 'Konuşma bulunamadı' });
        }

        res.json({
            phone: phone,
            history: conversation,
            messageCount: conversation.length
        });
    } catch (error) {
        console.error('❌ Konuşma detay getirme hatası:', error);
        res.status(500).json({ error: 'Konuşma detayı alınamadı' });
    }
});

app.delete('/api/conversations/:phone', (req, res) => {
    try {
        const { phone } = req.params;
        delete messageHistory[phone];
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Konuşma silme hatası:', error);
        res.status(500).json({ error: 'Konuşma silinemedi' });
    }
});

app.delete('/api/conversations', (req, res) => {
    try {
        Object.keys(messageHistory).forEach(phone => {
            delete messageHistory[phone];
        });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Tüm konuşmaları silme hatası:', error);
        res.status(500).json({ error: 'Konuşmalar silinemedi' });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        await client.logout();
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        }
        whatsappState.isReady = false;
        whatsappState.isAuthenticated = false;
        whatsappState.qrCode = null;

        res.json({ success: true });
        console.log('🚪 Oturum kapatıldı');

        setTimeout(() => {
            initializeWhatsApp();
        }, 2000);

    } catch (err) {
        console.error('Çıkış hatası:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/restart', async (req, res) => {
    try {
        console.log('🔄 Manuel restart isteği...');
        await client.destroy();
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        }

        whatsappState.isReady = false;
        whatsappState.isAuthenticated = false;
        whatsappState.qrCode = null;

        setTimeout(() => {
            initializeWhatsApp();
        }, 1000);

        res.json({ success: true, message: 'Yeniden başlatılıyor' });
    } catch (error) {
        console.error('Restart hatası:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

io.on('connection', (socket) => {
    console.log('🔌 Yeni socket bağlantısı:', socket.id);

    socket.emit('whatsapp_status', {
        status: whatsappState.isReady ? 'ready' :
            whatsappState.qrCode ? 'qr_required' :
                whatsappState.isConnecting ? 'connecting' : 'disconnected',
        hasSession: fs.existsSync(SESSION_DIR),
        isReady: whatsappState.isReady
    });

    socket.on('get_status', () => {
        socket.emit('whatsapp_status', {
            status: whatsappState.isReady ? 'ready' :
                whatsappState.qrCode ? 'qr_required' :
                    whatsappState.isConnecting ? 'connecting' : 'disconnected',
            hasSession: fs.existsSync(SESSION_DIR),
            isReady: whatsappState.isReady
        });
    });

    socket.on('get_qr', () => {
        if (qrCode) {
            socket.emit('qr', qrCode);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket bağlantısı kesildi:', socket.id);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

server.listen(3000, () => {
    console.log('🚀 Server 3000 portunda çalışıyor.');
    console.log('📱 WhatsApp session durumu:', fs.existsSync(SESSION_DIR) ? 'Mevcut' : 'Yok');
});
import fs from 'fs';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { handleMessage } from './groqService.js';

const SESSION_DIR = './.wwebjs_auth';
let whatsappState = { isReady: false, isAuthenticated: false, qrCode: null, isConnecting: false };
let client;

export const initializeWhatsApp = (io) => {
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
        puppeteer: { headless: true, args: ['--no-sandbox'] },
    });

    client.on('qr', (qr) => {
        whatsappState.qrCode = qr;
        io.emit('qr', qr);
    });

    client.on('authenticated', () => {
        whatsappState.isAuthenticated = true;
        io.emit('authenticated');
    });

    client.on('ready', () => {
        whatsappState.isReady = true;
        io.emit('ready');
    });

    client.on('message', async (msg) => {
        await handleMessage(client, msg, io);
    });

    client.initialize();
};

export const getClient = () => client;
export const getWhatsAppState = () => whatsappState;
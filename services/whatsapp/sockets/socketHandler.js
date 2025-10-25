import { getWhatsAppState } from '../services/whatsappService.js';
import fs from 'fs';

export const initSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('🔌 Yeni bağlantı:', socket.id);
        const state = getWhatsAppState();
        socket.emit('whatsapp_status', {
            isReady: state.isReady,
            hasQr: !!state.qrCode,
            hasSession: fs.existsSync('./.wwebjs_auth')
        });

        socket.on('disconnect', () => console.log('❌ Bağlantı kesildi:', socket.id));
    });
};

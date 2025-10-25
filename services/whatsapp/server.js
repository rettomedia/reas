import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { initSocket } from './sockets/socketHandler.js';
import { initializeWhatsApp } from './services/whatsappService.js';

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

initSocket(io);
initializeWhatsApp(io);

server.listen(3000, () => {
    console.log('WhatsApp servisi 3000 portunda çalışıyor.')
});
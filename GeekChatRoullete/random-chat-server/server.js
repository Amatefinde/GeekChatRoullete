// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // разрешить все источники
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // разрешить все распространённые методы
        allowedHeaders: ["*"], // разрешить любые заголовки
        credentials: true // если нужно поддерживать cookie/авторизацию
    }
});
let waitingPool = [];
const activeChats = {}; // { roomId: [socket1, socket2] }

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('start_search', (criteria) => {
        socket.criteria = criteria;
        const partner = findPartner(socket);

        if (partner) {
            const roomId = socket.id + '#' + partner.id;

            // Присоединяем обоих к комнате
            socket.join(roomId);
            partner.join(roomId);

            // Сохраняем информацию о чате
            activeChats[roomId] = [socket, partner];
            socket.roomId = roomId;
            partner.roomId = roomId;

            // Уведомляем обоих о начале чата
            io.to(roomId).emit('chat_found', {
                message: 'Собеседник найден!',
                roomId: roomId
            });
            console.log(`Chat started between ${socket.id} and ${partner.id} in room ${roomId}`);

        } else {
            waitingPool.push(socket);
            socket.emit('searching', { message: 'Ищем собеседника...' });
            console.log(`User ${socket.id} added to waiting pool`);
        }
    });

    socket.on('send_message', (data) => {
        // Отправляем сообщение только участникам комнаты
        socket.to(socket.roomId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        // Если пользователь был в чате, уведомляем партнера
        if (socket.roomId && activeChats[socket.roomId]) {
            const partner = activeChats[socket.roomId].find(s => s.id !== socket.id);
            if (partner) {
                partner.emit('partner_disconnected', { message: 'Собеседник отключился.' });
            }
            delete activeChats[socket.roomId];
        } else {
            // Если был в поиске, удаляем из пула
            waitingPool = waitingPool.filter(user => user.id !== socket.id);
        }
    });
});

function findPartner(socket) {
    const myCriteria = socket.criteria;

    for (let i = 0; i < waitingPool.length; i++) {
        const partnerSocket = waitingPool[i];
        const partnerCriteria = partnerSocket.criteria;

        // Проверка совместимости в обе стороны
        const iFitPartnerCriteria =
            (partnerCriteria.partnerGender === 'any' || partnerCriteria.partnerGender === myCriteria.myGender) &&
            (myCriteria.myAge >= partnerCriteria.partnerAge.min && myCriteria.myAge <= partnerCriteria.partnerAge.max);

        const partnerFitsMyCriteria =
            (myCriteria.partnerGender === 'any' || myCriteria.partnerGender === partnerCriteria.myGender) &&
            (partnerCriteria.myAge >= myCriteria.partnerAge.min && partnerCriteria.myAge <= myCriteria.partnerAge.max);

        if (iFitPartnerCriteria && partnerFitsMyCriteria) {
            // Найден партнер! Удаляем его из пула ожидания
            waitingPool.splice(i, 1);
            return partnerSocket;
        }
    }
    return null; // Партнер не найден
}

const PORT = 3228;
server.listen(PORT, () => {
    console.log(`SERVER IS RUNNING ON PORT ${PORT}`);
});
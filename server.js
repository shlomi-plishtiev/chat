import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesFilePath = path.join(__dirname, 'messages.json');

function loadMessages() {
    try {
        if (fs.existsSync(messagesFilePath)) {
            const data = fs.readFileSync(messagesFilePath);
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading or parsing messages file:', error);
    }
    return { messages: [] };
}

function saveMessages(messages) {
    try {
        fs.writeFileSync(messagesFilePath, JSON.stringify(messages, null, 2));
    } catch (error) {
        console.error('Error writing messages file:', error);
    }
}

function deleteAllMessages() {
    try {
        fs.writeFileSync(messagesFilePath, JSON.stringify({ messages: [] }, null, 2));
    } catch (error) {
        console.error('Error deleting messages:', error);
    }
}

const chatMessages = loadMessages();

app.use(express.static(join(__dirname, 'public')));

let connectedUsers = [];

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public/index.html'));
});

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.emit('add-msgs', chatMessages.messages);

    socket.on('set-user-socket', (nickname) => {
        socket.nickname = nickname;
        connectedUsers.push({ nickname, id: socket.id });
        io.emit('update-users', connectedUsers);
    });

    socket.on('send-msg', (msg) => {
        if (!chatMessages.messages) {
            chatMessages.messages = [];
        }

        chatMessages.messages.push(msg);
        saveMessages(chatMessages);

        if (msg.to) {
            const recipientSocketId = connectedUsers.find(user => user.nickname === msg.to)?.id;
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('add-msg', msg);
            } else {
                console.log(`User ${msg.to} not found`);
            }
        } else {
            io.emit('add-msg', msg);
        }
    });

    socket.on('delete-all-msgs', () => {
        chatMessages.messages = [];
        deleteAllMessages();
        io.emit('add-msgs', chatMessages.messages);
    });

    socket.on('disconnect', () => {
        connectedUsers = connectedUsers.filter(user => user.id !== socket.id);
        io.emit('update-users', connectedUsers);
    });
});

const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

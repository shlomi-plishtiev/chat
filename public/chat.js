const socket = io();
const nickname = sessionStorage.nickname || prompt('Welcome, your name?');
sessionStorage.nickname = nickname;

let gTopic = 'politics';
onSetTopic(gTopic);

socket.emit('set-user-socket', nickname);

document.getElementById('name').innerText = nickname;

let isAtBottom = true;

socket.on('add-msgs', msgs => {
    if (Array.isArray(msgs)) {
        document.querySelector('#messages').innerHTML = '';
        msgs.forEach(addMsg);
        if (isAtBottom) {
            scrollToBottom();
        }
    } else {
        console.error('Received invalid data from server');
    }
});

socket.on('add-msg', msg => {
    addMsg(msg);
    if (msg.from === nickname) {
        scrollToBottom();
    } else if (!isAtBottom && document.visibilityState === 'hidden') {
        showNotification(msg);
    }
});

function onSetTopic(topic) {
    gTopic = topic;
    socket.emit('set-topic', topic);
}

function addMsg(msg) {
    const elUl = document.querySelector('#messages');
    const from = msg.from === nickname ? 'sent' : 'received';

    let msgContent = msg.txt ? `<p>${msg.txt}</p>` : '';

    if (msg.files) {
        msg.files.forEach(file => {
            if (file.type.startsWith('image/')) {
                msgContent += `<img src="${file.data}" class="chat-media" onclick="openFullscreen(this)">`;
            } else if (file.type.startsWith('video/')) {
                msgContent += `<video controls class="chat-media" onclick="openFullscreen(this)">
                                  <source src="${file.data}" type="${file.type}">
                                </video>`;
            } else if (file.type.startsWith('audio/')) {
                msgContent += `<audio controls class="chat-media">
                                  <source src="${file.data}" type="${file.type}">
                                </audio>`;
            }
        });
    }

    elUl.innerHTML += `<li class="${from} message">${msgContent}</li>`;
}

function scrollToBottom() {
    const elUl = document.querySelector('#messages');
    elUl.scrollTop = elUl.scrollHeight;
}

function showNotification(msg) {
    if (Notification.permission === 'granted') {
        new Notification('New Message', {
            body: `${msg.from}: ${msg.txt || 'Sent a file'}`,
            icon: '/path/to/icon.png'
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showNotification(msg);
            }
        });
    }
}

if (Notification.permission === 'default') {
    Notification.requestPermission();
}

document.querySelector('#messages').addEventListener('scroll', () => {
    const elUl = document.querySelector('#messages');
    isAtBottom = elUl.scrollHeight - elUl.clientHeight <= elUl.scrollTop + 1;
});

async function onSendMsg(ev) {
    ev.preventDefault();

    const elInput = document.querySelector('#input');
    const elFileInput = document.querySelector('#file-input');
    const msg = {
        txt: elInput.value,
        from: nickname,
        topic: gTopic,
    };

    if (elFileInput.files.length) {
        const file = elFileInput.files[0];
        const fileData = await readFile(file);
        msg.files = [fileData];
    }

    if (elInput.value || elFileInput.files.length) {
        socket.emit('send-msg', msg);
    }

    elInput.value = '';
    elFileInput.value = '';
    document.getElementById('image-preview').innerHTML = '';
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            resolve({
                data: e.target.result,
                type: file.type
            });
        };
        reader.onerror = function (error) {
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}

function openFullscreen(el) {
    const fullscreenImg = document.createElement('img');
    fullscreenImg.src = el.src;
    fullscreenImg.className = 'fullscreen-img';
    document.body.appendChild(fullscreenImg);
    fullscreenImg.addEventListener('click', () => {
        document.body.removeChild(fullscreenImg);
    });
}

function addEmoji(emoji) {
    const input = document.getElementById('input');
    input.value += emoji;
    emojiPicker.style.display = 'none';
}

function previewImage(event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('image-preview');

    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewContainer.innerHTML = `<img src="${e.target.result}" class="preview-img">`;
        };
        reader.readAsDataURL(file);
    } else {
        previewContainer.innerHTML = '';
    }
}

let mediaRecorder;
let audioChunks = [];

function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        document.getElementById('record-btn').innerText = '🎙️';
    } else {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            document.getElementById('record-btn').innerText = '🔴';
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audioPlayer = document.getElementById('audio-player');
                audioPlayer.src = audioUrl;
                audioChunks = [];
                socket.emit('send-msg', {
                    from: nickname,
                    topic: gTopic,
                    files: [{ data: audioUrl, type: 'audio/wav' }]
                });
            };
        });
    }
}

const emojiButton = document.getElementById('emoji-button');
const emojiPicker = document.getElementById('emoji-picker');
emojiPicker.style.display = 'none';

emojiButton.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
});

document.querySelector('#file-input').addEventListener('change', previewImage);
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu');
const deleteChatBtn = document.getElementById('delete-chat-btn');

menuBtn.addEventListener('click', () => {
    if (menu.classList.contains('menu-hidden')) {
        menu.classList.remove('menu-hidden');
        menu.classList.add('menu-visible');
    } else {
        menu.classList.remove('menu-visible');
        menu.classList.add('menu-hidden');
    }
});

deleteChatBtn.addEventListener('click', () => {
    document.getElementById('messages').innerHTML = '';
    menu.classList.remove('menu-visible');
    menu.classList.add('menu-hidden');
    socket.emit('delete-all-msgs');
});

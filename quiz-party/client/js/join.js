import { socket } from './socket.js';

const codeInput = document.getElementById('code');
const nameInput = document.getElementById('name');
const joinBtn = document.getElementById('join-button');
const errorP = document.getElementById('join-error');

joinBtn.addEventListener('click', () => {
  const code = codeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  if (!code || !name) {
    errorP.textContent = 'Bitte Code und Namen eingeben.';
    return;
  }
  errorP.textContent = '';
  socket.connect();
  socket.emit('joinGame', { code, name });
});

socket.on('joined', ({ playerId, token, name }) => {
  const code = codeInput.value.trim().toUpperCase();
  // Speichere Token und Code im localStorage
  localStorage.setItem('quizPartyCode', code);
  localStorage.setItem('quizPartyToken', token);
  localStorage.setItem('quizPartyName', name);
  // Redirect zu play.html
  window.location.href = 'play.html';
});

socket.on('error', ({ message }) => {
  errorP.textContent = message;
});
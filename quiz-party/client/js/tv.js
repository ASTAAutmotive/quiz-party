import { socket } from './socket.js';

// DOM-Elemente
const createBtn = document.getElementById('create-game');
const gameInfoDiv = document.getElementById('game-info');
const gameCodeSpan = document.getElementById('game-code');
const playerListEl = document.getElementById('player-list');
const startBtn = document.getElementById('start-game');
const lobbyDiv = document.getElementById('lobby');
const gameArea = document.getElementById('game-area');
const questionTextEl = document.getElementById('question-text');
const optionsListEl = document.getElementById('options-list');
const countdownEl = document.getElementById('countdown');
const answersCountEl = document.getElementById('answers-count');
const revealArea = document.getElementById('reveal-area');
const correctAnswerEl = document.getElementById('correct-answer');
const leaderboardArea = document.getElementById('leaderboard-area');
const leaderboardTableDiv = document.getElementById('leaderboard-table');
const endArea = document.getElementById('end-area');
const finalLeaderboardDiv = document.getElementById('final-leaderboard');

let gameCode = null;
let countdownInterval = null;

createBtn.addEventListener('click', () => {
  socket.connect();
  socket.emit('createGame');
});

startBtn.addEventListener('click', () => {
  if (gameCode) {
    socket.emit('startGame', { code: gameCode });
    startBtn.disabled = true;
  }
});

// Socket-Events
socket.on('gameCreated', ({ code }) => {
  gameCode = code;
  gameCodeSpan.textContent = code;
  gameInfoDiv.classList.remove('hidden');
});

socket.on('playerListUpdated', ({ players }) => {
  // Aktualisiere Liste
  playerListEl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name + (p.connected ? '' : ' (offline)');
    playerListEl.appendChild(li);
  });
  // Start-Button aktivieren, wenn mind. ein Spieler
  startBtn.disabled = players.length === 0;
});

socket.on('gameLocked', () => {
  lobbyDiv.classList.add('hidden');
  gameArea.classList.remove('hidden');
});

socket.on('questionStart', ({ question, options, endsAt }) => {
  // Anzeige vorbereiten
  questionTextEl.textContent = question;
  optionsListEl.innerHTML = '';
  options.forEach(opt => {
    const p = document.createElement('p');
    p.textContent = opt;
    optionsListEl.appendChild(p);
  });
  countdownEl.textContent = '';
  answersCountEl.textContent = '';
  revealArea.classList.add('hidden');
  leaderboardArea.classList.add('hidden');
  endArea.classList.add('hidden');
  // Countdown
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const remaining = Math.max(0, endsAt - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    countdownEl.textContent = `Zeit: ${seconds}s`;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
    }
  }, 200);
});

socket.on('answersCountUpdate', ({ answered, connected }) => {
  answersCountEl.textContent = `Antworten: ${answered}/${connected}`;
});

socket.on('revealAnswer', ({ correctIndex, perPlayerResults }) => {
  // Zeige richtige Antwort (anhand der aktuellen Optionsliste)
  const correctText = optionsListEl.children[correctIndex]?.textContent || '';
  correctAnswerEl.textContent = correctText;
  revealArea.classList.remove('hidden');
});

socket.on('leaderboard', ({ leaderboard }) => {
  leaderboardArea.classList.remove('hidden');
  revealArea.classList.add('hidden');
  // Erstelle Tabelle
  leaderboardTableDiv.innerHTML = '';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Platz', 'Name', 'Punkte'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  leaderboard.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    const rankTd = document.createElement('td');
    rankTd.textContent = idx + 1;
    const nameTd = document.createElement('td');
    nameTd.textContent = entry.name;
    const pointsTd = document.createElement('td');
    pointsTd.textContent = entry.points;
    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(pointsTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  leaderboardTableDiv.appendChild(table);
});

socket.on('gameEnd', ({ leaderboard }) => {
  endArea.classList.remove('hidden');
  leaderboardArea.classList.add('hidden');
  revealArea.classList.add('hidden');
  questionTextEl.textContent = '';
  optionsListEl.innerHTML = '';
  answersCountEl.textContent = '';
  countdownEl.textContent = '';
  // Tabelle für finales Ranking
  finalLeaderboardDiv.innerHTML = '';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Platz', 'Name', 'Punkte'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  leaderboard.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    const rankTd = document.createElement('td');
    rankTd.textContent = idx + 1;
    const nameTd = document.createElement('td');
    nameTd.textContent = entry.name;
    const pointsTd = document.createElement('td');
    pointsTd.textContent = entry.points;
    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(pointsTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  finalLeaderboardDiv.appendChild(table);
});

socket.on('error', ({ message }) => {
  alert(message);
});
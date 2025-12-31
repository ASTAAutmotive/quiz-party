import { socket } from './socket.js';

// DOM Elemente
const waitingArea = document.getElementById('waiting-area');
const questionArea = document.getElementById('question-area');
const questionTextEl = document.getElementById('question-text');
const optionsDiv = document.getElementById('question-options');
const countdownEl = document.getElementById('player-countdown');
const revealArea = document.getElementById('reveal-area');
const correctAnswerEl = document.getElementById('player-correct-answer');
const leaderboardArea = document.getElementById('leaderboard-area');
const leaderboardDiv = document.getElementById('player-leaderboard');
const endArea = document.getElementById('end-area');
const finalLeaderboardDiv = document.getElementById('player-final-leaderboard');

let code = localStorage.getItem('quizPartyCode');
let token = localStorage.getItem('quizPartyToken');

if (!code || !token) {
  // Wenn kein Code oder Token -> zurück zu join.html
  window.location.href = 'join.html';
} else {
  // Stelle Verbindung her
  socket.connect();
  socket.emit('reconnectGame', { code, token });
}

let currentQuestionIndex = null;
let endsAt = null;
let countdownInterval = null;
let hasAnswered = false;

// Zeigt eine Frage mit Antwortbuttons
function showQuestion(question, options, endTimestamp) {
  waitingArea.classList.add('hidden');
  questionArea.classList.remove('hidden');
  revealArea.classList.add('hidden');
  leaderboardArea.classList.add('hidden');
  endArea.classList.add('hidden');
  questionTextEl.textContent = question;
  optionsDiv.innerHTML = '';
  // Theme-compatible Grid
  optionsDiv.classList.add('answers');
  hasAnswered = false;
  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    // Theme styles
    btn.className = 'answer';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (hasAnswered) return;
      // Antwort senden
      socket.emit('submitAnswer', { code, questionIndex: currentQuestionIndex, answerIndex: idx });
      // Buttons deaktivieren
      Array.from(optionsDiv.children).forEach(b => b.disabled = true);
      hasAnswered = true;
    });
    optionsDiv.appendChild(btn);
  });
  // Countdown starten
  endsAt = endTimestamp;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const remaining = Math.max(0, endsAt - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    countdownEl.textContent = `Zeit: ${seconds}s`;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
    }
  }, 200);
}

socket.on('syncState', ({ state, questionIndex, endsAt: serverEndsAt, question, options, points, answered }) => {
  // Synchronisation bei reconnect
  currentQuestionIndex = questionIndex;
  hasAnswered = answered;
  if (state === 'QUESTION') {
    showQuestion(question, options, serverEndsAt);
    // Wenn Spieler schon geantwortet hat, Buttons deaktivieren
    if (answered) {
      Array.from(optionsDiv.children).forEach(b => b.disabled = true);
    }
  } else if (state === 'REVEAL') {
    // Zeige richtige Antwort
    questionArea.classList.add('hidden');
    revealArea.classList.remove('hidden');
    correctAnswerEl.textContent = options[question.answerIndex];
  } else if (state === 'LEADERBOARD') {
    leaderboardArea.classList.remove('hidden');
    // Leaderboard wird via separatem Event kommen
  } else if (state === 'END') {
    endArea.classList.remove('hidden');
  }
});

socket.on('questionStart', ({ questionIndex, question, options, endsAt: endTimestamp }) => {
  currentQuestionIndex = questionIndex;
  showQuestion(question, options, endTimestamp);
});

socket.on('revealAnswer', ({ correctIndex }) => {
  questionArea.classList.add('hidden');
  revealArea.classList.remove('hidden');
  // hole Text der richtigen Option
  const correctText = optionsDiv.children[correctIndex]?.textContent || '';
  correctAnswerEl.textContent = correctText;
});

socket.on('leaderboard', ({ leaderboard }) => {
  leaderboardArea.classList.remove('hidden');
  revealArea.classList.add('hidden');
  // Tabelle erstellen
  leaderboardDiv.innerHTML = '';
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
  leaderboardDiv.appendChild(table);
});

socket.on('gameEnd', ({ leaderboard }) => {
  endArea.classList.remove('hidden');
  questionArea.classList.add('hidden');
  revealArea.classList.add('hidden');
  leaderboardArea.classList.add('hidden');
  waitingArea.classList.add('hidden');
  // Endrangliste erstellen
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
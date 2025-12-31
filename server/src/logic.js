import { questions as allQuestions } from './questionBank.js';

/**
 * Zeitlimit pro Frage in Millisekunden
 */
// Lese Zeitlimit aus Umgebungsvariablen; Default 30 s (30000 ms)
const TIME_LIMIT_MS = parseInt(process.env.DEFAULT_QUESTION_MS || '30000', 10);

/**
 * Mischt ein Array zufällig und gibt eine neue Kopie zurück.
 */
function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Startet das Spiel: wählt Fragen aus und startet die erste Frage.
 */
export function startGame(game, io) {
  // Wähle Fragen aus (hier alle 20, zufällige Reihenfolge)
  game.questions = shuffle(allQuestions).slice(0, 20);
  game.questionIndex = 0;
  game.state = 'QUESTION';
  startQuestion(game, io);
}

/**
 * Startet die aktuelle Frage und setzt den Timer.
 */
export function startQuestion(game, io) {
  const question = game.questions[game.questionIndex];
  game.answers = new Map();
  const now = Date.now();
  game.endsAt = now + TIME_LIMIT_MS;

  // Setze answered-Flag für alle Spieler zurück
  game.players.forEach(player => {
    player.answered = false;
  });

  // Sende an alle Clients die Frage
  io.to(game.code).emit('questionStart', {
    questionIndex: game.questionIndex,
    question: question.question,
    options: question.options,
    endsAt: game.endsAt
  });

  // Starte Timeout für das Ende der Frage
  if (game.questionTimeout) clearTimeout(game.questionTimeout);
  game.questionTimeout = setTimeout(() => {
    endQuestion(game, io, 'timer');
  }, TIME_LIMIT_MS + 100); // kleiner Puffer
}

/**
 * Verarbeitet eine Antwort eines Spielers.
 */
export function submitAnswer(game, playerId, answerIndex, io) {
  // Ignoriere, wenn die Frage bereits beendet ist
  if (game.state !== 'QUESTION') return;
  const player = game.players.get(playerId);
  if (!player) return;
  // Speichere nur die erste Antwort
  if (game.answers.has(playerId)) return;
  game.answers.set(playerId, answerIndex);
  player.answered = true;

  // Prüfe, ob alle verbundenen Spieler geantwortet haben
  const connectedPlayers = Array.from(game.players.values()).filter(p => p.connected);
  const allAnswered = connectedPlayers.every(p => game.answers.has(p.id));
  if (allAnswered) {
    endQuestion(game, io, 'allAnswered');
  } else {
    // Informiere Host über Anzahl Antworten
    io.to(game.hostSocketId).emit('answersCountUpdate', {
      answered: game.answers.size,
      connected: connectedPlayers.length
    });
  }
}

/**
 * Beendet die aktuelle Frage, wertet die Antworten aus und zeigt die Rangliste an.
 */
export function endQuestion(game, io, reason) {
  if (game.state !== 'QUESTION') return;
  game.state = 'REVEAL';
  if (game.questionTimeout) {
    clearTimeout(game.questionTimeout);
    game.questionTimeout = null;
  }
  const question = game.questions[game.questionIndex];
  const correctIndex = question.answerIndex;
  // Punkte vergeben
  const isFinal = game.questionIndex >= 17; // letzte 3 Fragen (index 17, 18, 19)
  const pointsForCorrect = isFinal ? 300 : 100;
  const perPlayerResults = [];
  game.players.forEach(player => {
    const submitted = game.answers.get(player.id);
    const correct = submitted === correctIndex;
    if (correct) {
      player.points += pointsForCorrect;
    }
    perPlayerResults.push({
      playerId: player.id,
      name: player.name,
      submitted,
      correct,
      totalPoints: player.points
    });
  });
  // Sortiere Ergebnisse für die Rangliste
  const leaderboard = Array.from(game.players.values())
    .map(p => ({ name: p.name, points: p.points }))
    .sort((a, b) => b.points - a.points);
  // Sende Reveal an alle
  io.to(game.code).emit('revealAnswer', {
    correctIndex,
    perPlayerResults,
    leaderboard
  });
  // Nach kurzer Pause Rangliste anzeigen
  setTimeout(() => {
    showLeaderboard(game, io);
  }, 3000);
}

/**
 * Zeigt die Rangliste und startet entweder die nächste Frage oder beendet das Spiel.
 */
function showLeaderboard(game, io) {
  game.state = 'LEADERBOARD';
  // Erstelle sortiertes Leaderboard
  const leaderboard = Array.from(game.players.values())
    .map(p => ({ name: p.name, points: p.points }))
    .sort((a, b) => b.points - a.points);
  io.to(game.code).emit('leaderboard', { leaderboard, nextIn: 5000 });
  // Nach einigen Sekunden zur nächsten Frage oder zum Ende wechseln
  setTimeout(() => {
    if (game.questionIndex < game.questions.length - 1) {
      game.questionIndex += 1;
      game.state = 'QUESTION';
      startQuestion(game, io);
    } else {
      // Spiel vorbei
      game.state = 'END';
      io.to(game.code).emit('gameEnd', { leaderboard });
      // Spiel entfernen
      // (optional: nach einigen Minuten löschen)
    }
  }, 5000);
}
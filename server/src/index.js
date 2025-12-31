import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { GameStore } from './gameStore.js';
import { startGame, submitAnswer } from './logic.js';
import { nanoid } from 'nanoid';

// Erstelle Express-App und HTTP-Server
const app = express();
const httpServer = createServer(app);

// Socket.IO konfigurieren
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Stelle statische Dateien aus dem client-Ordner bereit
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientPath = path.join(__dirname, '..', '..', 'client');
app.use(express.static(clientPath));
// Friendly redirects (Backward compat)
app.get('/', (req, res) => res.redirect('/tv.html'));
app.get('/tv', (req, res) => res.redirect('/tv.html'));
app.get('/join', (req, res) => res.redirect('/join.html'));
app.get('/play', (req, res) => res.redirect('/play.html'));

// Verwende GameStore für mehrere Spiele
const store = new GameStore();

// Konfigurierbare Limits (können über Umgebungsvariablen angepasst werden)
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '30', 10);
const MIN_JOIN_INTERVAL_MS = parseInt(process.env.MIN_JOIN_INTERVAL_MS || '500', 10); // 0,5 s zwischen Join‑Versuchen
const MIN_ANSWER_INTERVAL_MS = parseInt(process.env.MIN_ANSWER_INTERVAL_MS || '200', 10); // 0,2 s zwischen Antworten

// In‑Memory‑Tracker für Rate‑Limiting
const joinAttempts = new Map(); // socket.id → Zeitstempel des letzten Join‑Versuchs
const answerAttempts = new Map(); // socket.id → Zeitstempel der letzten Antwort

// Einfache Liste unerwünschter Wörter für den Profanity‑Filter
const BANNED_WORDS = ['fuck', 'shit', 'arsch', 'bitch'];

/**
 * Sanitize den Spielernamen:
 *  - Trim whitespace
 *  - Entferne HTML‑Tags
 *  - Ersetze unerwünschte Wörter durch Sternchen
 *  - Kürze auf 30 Zeichen
 */
function sanitizeName(name) {
  if (!name) return '';
  // Trim und Tags entfernen
  let clean = name.trim().replace(/<[^>]*>/g, '');
  // Kürzen
  if (clean.length > 30) clean = clean.slice(0, 30);
  // Profanity‑Filter
  const regex = new RegExp(BANNED_WORDS.join('|'), 'gi');
  clean = clean.replace(regex, (match) => '*'.repeat(match.length));
  return clean;
}

io.on('connection', (socket) => {
  console.log('Client verbunden', socket.id);

  // Host erstellt Spiel
  socket.on('createGame', () => {
    const game = store.createGame();
    game.hostSocketId = socket.id;
    socket.join(game.code);
    socket.emit('gameCreated', { code: game.code });
    console.log('Neues Spiel erstellt:', game.code);
  });

  // Spieler tritt einem Spiel bei
  socket.on('joinGame', ({ code, name }) => {
    // Rate‑Limit Join: Verhindere Spamversuche
    const nowTs = Date.now();
    const lastJoin = joinAttempts.get(socket.id) || 0;
    if (nowTs - lastJoin < MIN_JOIN_INTERVAL_MS) {
      socket.emit('error', { message: 'Bitte warte einen Moment, bevor du erneut beitrittst.' });
      return;
    }
    joinAttempts.set(socket.id, nowTs);

    const game = store.getGame(code);
    if (!game) {
      socket.emit('error', { message: 'Spiel existiert nicht' });
      return;
    }
    if (game.state !== 'LOBBY') {
      socket.emit('error', { message: 'Spiel bereits gestartet' });
      return;
    }
    // Max‑Spieler prüfen
    if (game.players.size >= MAX_PLAYERS) {
      socket.emit('error', { message: 'Spiel ist voll' });
      return;
    }
    // Erstelle PlayerId und Token (hier identisch)
    const playerId = socket.id;
    const token = nanoid();
    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      socket.emit('error', { message: 'Ungültiger Name' });
      return;
    }
    const player = {
      id: playerId,
      name: sanitizedName,
      token,
      points: 0,
      connected: true,
      answered: false
    };
    game.players.set(playerId, player);
    socket.join(game.code);
    // Sende Token und Id zurück
    socket.emit('joined', { playerId, token, name: sanitizedName });
    // Aktualisiere Spielerliste auf TV
    io.to(game.hostSocketId).emit('playerListUpdated', {
      players: Array.from(game.players.values()).map(p => ({ id: p.id, name: p.name, connected: p.connected }))
    });
    console.log(`Spieler ${name} beigetreten in Spiel ${code}`);
  });

  // Spieler versucht, sich durch gespeichertes Token erneut zu verbinden
  socket.on('reconnectGame', ({ code, token }) => {
    const game = store.getGame(code);
    if (!game) {
      socket.emit('error', { message: 'Spiel existiert nicht' });
      return;
    }

    // Finde Player-Eintrag (inkl. Map-Key), nicht nur das Objekt
    const entry = Array.from(game.players.entries()).find(([id, p]) => p.token === token);
    if (!entry) {
      socket.emit('error', { message: 'Spieler nicht gefunden' });
      return;
    }
    const [oldId, player] = entry;

    // Wenn sich die socket.id geändert hat, migriere den Map-Key und ggf. die Antwort-Einträge
    if (oldId !== socket.id) {
      // Entferne alten Eintrag und setze neuen Key
      game.players.delete(oldId);
      player.id = socket.id;
      player.connected = true;
      game.players.set(socket.id, player);

      // Migriere vorhandene Antwort (falls vorhanden) auf die neue socket.id
      if (game.answers && game.answers.has(oldId)) {
        const ans = game.answers.get(oldId);
        game.answers.delete(oldId);
        game.answers.set(socket.id, ans);
      }
    } else {
      // gleiche id (sehr selten), nur Status setzen
      player.connected = true;
      player.id = socket.id;
      game.players.set(socket.id, player);
    }

    socket.join(game.code);
    // schicke aktuellen Zustand zurück
    const currentQuestion = game.questions[game.questionIndex] || {};
    socket.emit('syncState', {
      state: game.state,
      questionIndex: game.questionIndex,
      endsAt: game.endsAt,
      question: currentQuestion.question,
      options: currentQuestion.options,
      points: player.points,
      answered: game.answers.has(player.id)
    });
    // Aktualisiere Spielerliste auf TV
    io.to(game.hostSocketId).emit('playerListUpdated', {
      players: Array.from(game.players.values()).map(p => ({ id: p.id, name: p.name, connected: p.connected }))
    });
    console.log(`Spieler ${player.name} reconnect in Spiel ${code}`);
  });

  // Host startet das Spiel
  socket.on('startGame', ({ code }) => {
    const game = store.getGame(code);
    if (!game) {
      socket.emit('error', { message: 'Spiel existiert nicht' });
      return;
    }
    if (game.state !== 'LOBBY') {
      socket.emit('error', { message: 'Spiel bereits gestartet' });
      return;
    }
    game.state = 'LOCKED';
    // Informiere Spieler, dass das Spiel beginnt
    io.to(game.code).emit('gameLocked', {});
    // Starte das Spiel
    startGame(game, io);
    console.log('Spiel gestartet:', code);
  });

  // Spieler sendet Antwort
  socket.on('submitAnswer', ({ code, questionIndex, answerIndex }) => {
    const game = store.getGame(code);
    if (!game) return;
    // Rate‑Limit Antworten
    const now = Date.now();
    const last = answerAttempts.get(socket.id) || 0;
    if (now - last < MIN_ANSWER_INTERVAL_MS) {
      return; // ignoriere zu schnelle Mehrfachklicks
    }
    answerAttempts.set(socket.id, now);
    submitAnswer(game, socket.id, answerIndex, io);
  });

  // Verarbeite Disconnect
  socket.on('disconnect', () => {
    // Markiere Spieler als offline, falls er in einem Spiel ist
    store.games.forEach(game => {
      const player = game.players.get(socket.id);
      if (player) {
        player.connected = false;
        // Aktualisiere Host-Anzeige
        io.to(game.hostSocketId).emit('playerListUpdated', {
          players: Array.from(game.players.values()).map(p => ({ id: p.id, name: p.name, connected: p.connected }))
        });
      }
    });
  });
});

// Health‑Endpoint für Deployment
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Starte Server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

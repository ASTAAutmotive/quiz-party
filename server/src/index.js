import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { GameStore } from './gameStore.js';
import { startGame, submitAnswer } from './logic.js';

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

// Verwende GameStore für mehrere Spiele
const store = new GameStore();

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
    const game = store.getGame(code);
    if (!game) {
      socket.emit('error', { message: 'Spiel existiert nicht' });
      return;
    }
    if (game.state !== 'LOBBY') {
      socket.emit('error', { message: 'Spiel bereits gestartet' });
      return;
    }
    // Erstelle PlayerId und Token (hier identisch)
    const playerId = socket.id;
    const token = socket.id;
    const player = {
      id: playerId,
      name,
      token,
      points: 0,
      connected: true,
      answered: false
    };
    game.players.set(playerId, player);
    socket.join(game.code);
    // Sende Token und Id zurück
    socket.emit('joined', { playerId, token, name });
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
    const player = Array.from(game.players.values()).find(p => p.token === token);
    if (!player) {
      socket.emit('error', { message: 'Spieler nicht gefunden' });
      return;
    }
    // Update Socket ID und Status
    player.id = socket.id;
    player.connected = true;
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

// Starte Server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

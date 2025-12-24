import { customAlphabet } from 'nanoid';

// Nanoid zur Erstellung eines zufälligen Spielcodes (6 alphanumerische Zeichen)
const generateGameCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

/**
 * Spielzustand und Spieler werden im Speicher gehalten.
 * Dies ist ausreichend für ein MVP und lokal verwendbar.
 */
export class GameStore {
  constructor() {
    // gameCode → gameObjekt
    this.games = new Map();
  }

  /**
   * Erstellt ein neues Spiel und gibt das Game-Objekt zurück.
   */
  createGame() {
    let code;
    // Stelle sicher, dass der Code einzigartig ist
    do {
      code = generateGameCode();
    } while (this.games.has(code));
    const game = {
      code,
      state: 'LOBBY',
      players: new Map(), // playerId → Player
      questionIndex: 0,
      questions: [],
      endsAt: null,
      answers: new Map(),
      hostSocketId: null
    };
    this.games.set(code, game);
    return game;
  }

  getGame(code) {
    return this.games.get(code);
  }

  /**
   * Entfernt ein Spiel aus dem Store (z. B. nach Spielende).
   */
  deleteGame(code) {
    this.games.delete(code);
  }
}
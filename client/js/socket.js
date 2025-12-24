// Stellt eine Socket.IO-Verbindung her
// Die Verbindung verwendet standardmäßig denselben Host und Port wie die Seite.
export const socket = io({ autoConnect: false });
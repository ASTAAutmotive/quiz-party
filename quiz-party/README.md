# Quiz-Party Spiel – Anleitung

Dieses Repository enthält eine minimal lauffähige Version des Mehrspieler‑Quiz‑Spiels nach dem Prinzip „Wer wird Millionär“ für Smart‑TV und Smartphones.

## Projektstruktur

```
quiz-party/
  server/
    src/
      index.js         – Einstiegspunkt für den Node‑Server
      gameStore.js     – Verwaltung des Spielzustands und der Spieler
      logic.js         – Kernlogik für Fragen, Antworten und Punktevergabe
      questionBank.js  – Enthält 20 Beispiel‑Fragen
  client/
    tv.html            – Oberfläche für den Host/Smart‑TV
    join.html          – Seite zum Spielbeitritt mit Name und Spielcode
    play.html          – Seite für laufendes Spiel auf dem Handy
    assets/
      style.css        – Einfaches Styling für die Seiten
    js/
      socket.js        – Gemeinsame Socket‑Initialisierung
      tv.js            – Logik für die TV‑Oberfläche
      join.js          – Logik für die Join‑Seite
      play.js          – Logik für das Spielen auf dem Handy

```

## Voraussetzungen

* **Node.js** (aktuelle LTS‑Version) installiert.
* Ein Terminal (Windows PowerShell, macOS Terminal, Linux Shell).

## Backend aufsetzen

1. In ein Terminal wechseln und in das Projektverzeichnis navigieren:

   ```bash
   cd quiz-party/server
   ```

2. Abhängigkeiten installieren (Express und Socket.IO):

   ```bash
   npm install
   ```

3. Server starten:

   ```bash
   node src/index.js
   ```

   Der Server läuft standardmäßig auf Port `3001` und dient die statischen Dateien aus dem Ordner `client` aus.

## Frontend öffnen

Du kannst die Seiten lokal im Browser öffnen. Für die Nutzung auf verschiedenen Geräten (TV/Handy) muss der Server im lokalen Netzwerk erreichbar sein. Angenommen dein Rechner hat die IP `192.168.0.100`:

* **TV:** `http://192.168.0.100:3001/tv.html`
* **Spieler:** `http://192.168.0.100:3001/join.html`

Hinweis: Im lokalen Browser kannst du `localhost` statt der IP nutzen, aber auf dem Smart‑TV und anderen Geräten musst du die IP deines Computers angeben.

## Spielablauf

1. **Spiel erstellen:** Öffne `tv.html` im Smart‑TV‑Browser. Klicke auf „Spiel erstellen“, es wird ein Code angezeigt.
2. **Beitreten:** Spieler öffnen `join.html` auf ihren Smartphones, geben den Code und einen Namen ein und treten bei.
3. **Start:** Wenn alle Spieler bereit sind, klicke auf „Spiel starten“ auf dem TV.
4. Das Spiel besteht aus 20 Fragen: 17 leichte Fragen mit 100 Punkten und 3 schwere Fragen mit 300 Punkten. Die Runde endet, sobald alle verbundenen Spieler geantwortet haben oder der Timer abläuft.
5. Nach jeder Frage wird die richtige Antwort und eine Rangliste angezeigt.
6. Am Ende der 20 Fragen wird der Sieger auf dem TV angezeigt.

Die Logik in `server/src/logic.js` sorgt dafür, dass Spieler nach einem Seiten‑Reload wieder an derselben Stelle weitermachen können. Verpasste Fragen werden nicht nachgeholt und zählen als keine Antwort (0 Punkte).

## Fragen anpassen

Die Datei `server/src/questionBank.js` enthält ein Array mit 20 Beispiel‑Fragen. Jede Frage hat die Felder `question`, `options` (Array aus vier Antwortmöglichkeiten) und `answerIndex` (Index der richtigen Antwort). Du kannst die Fragen ändern oder erweitern, indem du diese Datei bearbeitest.

## Lizenz

Dieses Projekt ist frei nutzbar und dient als Lernbeispiel für ein Mehrspieler‑Quiz. Viel Spaß beim Entwickeln und Ausprobieren!
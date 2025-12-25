FROM node:18-alpine

WORKDIR /app

# Server-Code kopieren
COPY server ./server

# Abhängigkeiten installieren
RUN cd server && npm install

# Port freigeben
EXPOSE 3000

# Server starten
CMD ["node", "server/src/index.js"]

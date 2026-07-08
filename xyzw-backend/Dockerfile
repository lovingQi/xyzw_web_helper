FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ src/
COPY migrations/ migrations/
COPY scripts/ scripts/

EXPOSE 3001

CMD ["node", "src/server.js"]

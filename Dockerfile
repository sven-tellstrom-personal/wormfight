FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY shared ./shared
COPY server ./server
COPY public ./public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]

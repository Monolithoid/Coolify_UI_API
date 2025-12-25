FROM node:20-alpine

WORKDIR /usr/src/app

COPY api/package.json ./package.json

RUN npm install --production

COPY api/src ./src
COPY api/.env.example ./.env.example
COPY web-app ./web-app

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["node", "src/app.js"]

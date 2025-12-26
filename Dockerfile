FROM node:20-alpine

WORKDIR /usr/src/app

COPY app/package.json ./package.json

RUN npm install --production

COPY app/src ./src
COPY app/.env.example ./.env.example
COPY app/web-app ./web-app
COPY data ./data

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["node", "src/app.js"]

FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install --production

COPY src ./src
COPY .env.example ./

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/app.js"]

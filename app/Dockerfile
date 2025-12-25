FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install --production

COPY src ./src
COPY web-app ./web-app
COPY .env.example ./

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["node", "src/app.js"]

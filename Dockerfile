FROM node:14-alpine
RUN mkdir -p /app/src/data && chown -R node:node /app
USER node
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY --chown=node:node . .
CMD node index.js

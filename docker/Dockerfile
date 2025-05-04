FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN yarn install
COPY . .
CMD ["node", "dist/server.js"]

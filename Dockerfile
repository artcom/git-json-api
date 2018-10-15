FROM node:9.11.2

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src ./src/
CMD ["npm", "start"]
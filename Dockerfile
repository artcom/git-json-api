FROM node:6.9.2

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src ./src/
CMD ["npm", "start"]
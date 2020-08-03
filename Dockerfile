FROM node:14.7.0-stretch
COPY . /app
WORKDIR /app
RUN npm install
CMD ["npm", "start"]

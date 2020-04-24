FROM node:12.13.0
COPY . /app
WORKDIR /app
RUN npm install
CMD ["npm", "start"]

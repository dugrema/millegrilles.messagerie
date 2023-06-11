# FROM node:18
FROM docker.maple.maceroc.com:5000/millegrilles_webappbase:2023.6.0

ENV APP_FOLDER=/usr/src/app \
    NODE_ENV=production \
    PORT=443 \
    MG_MQ_URL=amqps://mq:5673

EXPOSE 80 443

# Creer repertoire app, copier fichiers
# WORKDIR $APP_FOLDER

COPY . $APP_FOLDER/
RUN npm install --production

CMD [ "npm", "run", "server" ]

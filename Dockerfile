FROM node:4-slim
MAINTAINER Baard H. Rehn Johansen "baard.johansen@sesam.io"
COPY ./service /service
WORKDIR /service
RUN npm install
EXPOSE 5000
CMD [ "npm", "start" ]

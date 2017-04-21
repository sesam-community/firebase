FROM node:4-slim
MAINTAINER Baard H. Rehn Johansen "baard.johansen@sesam.io"
ARG BuildNumber=unknown
LABEL BuildNumber $BuildNumber
ARG Commit=unknown
LABEL Commit $Commit
COPY ./service /service
WORKDIR /service
RUN npm install
EXPOSE 5000
CMD [ "npm", "start" ]

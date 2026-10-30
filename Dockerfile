FROM node:22-slim
WORKDIR /app
COPY . .
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["node","server.mjs"]

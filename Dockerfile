FROM node:22-alpine AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
ENV VITE_API_URL=/api
RUN npm run build

FROM node:22-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src/ ./src/
COPY --from=frontend /app/client/dist/ /app/client/dist/
ENV NODE_ENV=production
ENV PORT=5000
USER node
EXPOSE 5000
CMD ["node", "src/index.js"]

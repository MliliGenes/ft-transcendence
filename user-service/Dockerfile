FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY nest-cli.json tsconfig*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src
# Config requires these values for generation; no database is contacted.
RUN POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=build \
    POSTGRES_PASSWORD=build POSTGRES_DB=build npx prisma generate \
    && npm run build

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]

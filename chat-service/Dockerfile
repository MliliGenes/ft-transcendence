FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY nest-cli.json tsconfig*.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3001
USER node
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]

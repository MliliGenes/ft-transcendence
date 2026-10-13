# Repo-root build context (see docker-compose or `docker build -f
# auth-profile-web/Dockerfile .`): the shared browser-auth package must be
# present before install so the `file:../packages/browser-auth` dependency
# resolves.
FROM node:24-alpine
WORKDIR /app/auth-profile-web
RUN chown node:node /app/auth-profile-web
USER node

COPY --chown=node:node auth-profile-web/package*.json ./
COPY --chown=node:node packages/browser-auth ../packages/browser-auth/
RUN npm ci && npm cache clean --force
COPY --chown=node:node auth-profile-web/. .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

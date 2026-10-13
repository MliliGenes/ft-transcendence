# Gateway image: static Auth + Arena SPAs served by nginx.
# Repo-root build context: the Arena frontend needs root workspaces and the
# auth SPA needs packages/browser-auth (same pattern as auth-profile-web).
# Auth API base (/api) is baked via VITE_API_URL; the gateway strips /api and
# rewrites cookie paths, so no dev-proxy cookiePathRewrite runs in prod.

# Arena (game) SPA -> /usr/share/nginx/html/play/
FROM node:22-alpine AS arena-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services ./services
COPY frontend ./frontend
RUN npm ci && npm run build --workspace arena-frontend -- --base=/play/

# Auth SPA -> /usr/share/nginx/html/
FROM node:24-alpine AS auth-build
WORKDIR /app/auth-profile-web
COPY auth-profile-web/package*.json ./
COPY packages/browser-auth ../packages/browser-auth/
RUN npm ci && npm cache clean --force
COPY auth-profile-web/. .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=arena-build /app/frontend/dist /usr/share/nginx/html/play/
COPY --from=auth-build /app/auth-profile-web/dist /usr/share/nginx/html/
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]

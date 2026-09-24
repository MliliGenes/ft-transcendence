# User service setup

NestJS is intentionally not scaffolded yet. From the repository root, run:

```powershell
npx @nestjs/cli@latest new user-service --directory user-service --package-manager npm --skip-git
```

Use a Node.js version supported by the latest Nest CLI. The current Nest docs
require Node 22.22.3+, 24.15+, or 26+ for generators; the installed Node 24.13.0
needs an update before using those generators.
See https://docs.nestjs.com/first-steps.

The root `.gitignore` already ignores `.env`, dependencies, and build output.
These setup notes use `SETUP.md` so the CLI can create its own `README.md`.

## Local PostgreSQL

Use your existing PostgreSQL server at `localhost:5432`. Edit `.env` to match your
actual username, password, port, and database. `nook_users` is a suggested database
name; create it with your PostgreSQL tools or use an existing development database.
No local database or PostgreSQL service settings have been changed by this setup.

The environment file only stores configuration. After generating Nest, add
environment loading (for example `@nestjs/config`) and your chosen database
driver/ORM to connect the application. No database connection is implemented yet.

```powershell
cd user-service
npm run start:dev
```

## Docker later

The Dockerfile and `.dockerignore` remain for containerizing the generated app.
Build after the CLI has created `package-lock.json`, the Nest config, and `src`:

```powershell
docker build -t nook-user-service .
```

There is no PostgreSQL container or Compose configuration. If you later run the
app in Docker Desktop and connect to your host PostgreSQL server, use
`host.docker.internal` as the database host instead of `localhost`.

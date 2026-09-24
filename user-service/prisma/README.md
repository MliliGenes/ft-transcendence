# Prisma scaffold

- `schema.prisma`: PostgreSQL datasource, client generator, and future models.
- `migrations/`: version-controlled migrations once models are defined.
- `../src/prisma/prisma.module.ts`: NestJS module for the future shared Prisma service.

This is a scaffold only. No database connection, models, migrations, or generated
client have been created, and the module is not yet registered in `AppModule`.

Before implementing the connection:

1. Align the Prisma CLI and client versions. Currently `prisma` is version 8 RC
   and `@prisma/client` is version 7, with different configuration APIs.
2. Add the matching Prisma configuration and PostgreSQL driver adapter, loading
   the database URL from the environment.
3. Define the models, generate the client, and create the initial migration.
4. Add a `PrismaService` with connection lifecycle hooks, export it from
   `PrismaModule`, and import the module where needed.

Generated client output belongs in `src/generated/prisma/` and is ignored by Git.

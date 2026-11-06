# Prisma reading guide for our chat service

The concepts behind our nested query objects are **relation queries**, especially
**nested reads** and **nested writes**. These resources use the official Prisma 7
documentation to match this project's version.

## Reading order

### 1. Understand how the schema connects models

[Relations](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations)

Read about `@relation`, foreign keys, and relation fields. In our schema, `userId`
is a database column; `user` is the relation field Prisma uses to navigate to
`ChatUser`. Fields such as `Group.members` describe relations rather than arrays
stored inside a database row.

### 2. Understand our membership table

[Explicit many-to-many relations](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/many-to-many-relations#explicit-many-to-many-relations)

This matches our `Group <-> GroupMember <-> ChatUser` design. A user can belong to
many groups, and a group can have many users. The explicit `GroupMember` model
also stores information about that relationship: `role` and `joinedAt`.

### 3. Choose which fields and relations to return

[Select fields: select and include](https://www.prisma.io/docs/orm/v7/prisma-client/queries/select-fields)

Learn why `members: true` returns membership records, why their related `user`
must be requested explicitly, and how to return just `username`, `displayName`,
and `avatarUrl` from that profile.

### 4. Work with nested reads, writes, and filters

[Relation queries](https://www.prisma.io/docs/orm/v7/prisma-client/queries/relation-queries)

This is the most relevant page for our current work. Focus on:

- Nested reads using `include` and `select`.
- Nested writes using `create`.
- Connecting existing records with `connect`.
- Relation filters: `some`, `every`, and `none`.

Our group access check uses a relation filter: find the requested group only if
its members include the authenticated user. Including members controls the
response; filtering by membership controls access.

### 5. Understand atomic writes

[Transactions and nested writes](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)

This explains why creating a group and its first membership through a nested
write succeeds or fails together. It also explains when to use an explicit
`$transaction` for operations that need additional logic between queries.

### 6. Inspect what Prisma sends to PostgreSQL

[Query logging](https://www.prisma.io/docs/orm/v7/prisma-client/observability-and-logging/logging)

Use query logging during local development to inspect the generated SQL. Compare
the SQL with the nested objects you pass to Prisma and the objects it returns.

## How nesting relates to SQL joins

A nested JavaScript result does not necessarily mean one SQL `JOIN`. Prisma can
load related records with database joins or with multiple queries assembled in
the application, depending on its relation loading strategy.

The Prisma 7 documentation describes `join` and `query` strategies. Selecting a
strategy through `relationLoadStrategy` requires the `relationJoins` preview
feature described on that page. Ordinary nested `include` queries do not require
you to configure this option.

[Relation load strategies](https://www.prisma.io/docs/orm/v7/prisma-client/queries/relation-queries#relation-load-strategies-preview)

## Practice using our project

Keep [schema.prisma](prisma/schema.prisma) open while reading. Use `getGroup` to
explore these steps, keeping the caller's membership check in place:

1. Fetch only the group's basic fields.
2. Include its `GroupMember` records.
3. Include each membership's related `ChatUser`.
4. Select only the profile fields the frontend needs.
5. Compare the returned objects and generated SQL at each step.

Then revisit `createGroup`: identify which part creates the group, which part
creates the ADMIN membership, and how Prisma supplies the new group's ID to
that membership.

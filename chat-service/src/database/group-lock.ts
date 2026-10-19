import type { Prisma } from '../generated/prisma/client.js';

// Every future group membership mutation must use this same transaction lock.
export async function lockGroup(
  tx: Prisma.TransactionClient,
  groupId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'chat-group:' + groupId}, 0))`;
}

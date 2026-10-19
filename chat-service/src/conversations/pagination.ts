import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export type Page = { limit: number; after?: { id: string; time: Date | null } };

export function readPage(query: Record<string, unknown>, scope: string): Page {
  if (Object.keys(query).some((key) => !['limit', 'cursor'].includes(key)))
    throw new BadRequestException('Unknown pagination option');
  const value = query.limit ?? '30';
  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]{0,2}$/.test(value) ||
    Number(value) > 100
  )
    throw new BadRequestException('limit must be between 1 and 100');
  if (query.cursor === undefined) return { limit: Number(value) };
  try {
    if (
      typeof query.cursor !== 'string' ||
      query.cursor.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(query.cursor)
    )
      throw new Error();
    const cursor = JSON.parse(
      Buffer.from(query.cursor, 'base64url').toString('utf8'),
    );
    if (
      !cursor ||
      cursor.scope !== scope ||
      typeof cursor.id !== 'string' ||
      !isUUID(cursor.id) ||
      !(
        cursor.time === null ||
        (typeof cursor.time === 'string' &&
          /^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/.test(
            cursor.time,
          ) &&
          new Date(cursor.time).toISOString() === cursor.time)
      )
    )
      throw new Error();
    return {
      limit: Number(value),
      after: {
        id: cursor.id.toLowerCase(),
        time: cursor.time === null ? null : new Date(cursor.time),
      },
    };
  } catch {
    throw new BadRequestException('Invalid cursor for this list');
  }
}

export function nextCursor(scope: string, id: string, time: Date | null) {
  return Buffer.from(
    JSON.stringify({ scope, id, time: time?.toISOString() ?? null }),
  ).toString('base64url');
}

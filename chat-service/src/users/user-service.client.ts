import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID, isISO8601 } from 'class-validator';
import { validInternalSecret } from '../auth/internal-secret.guard.js';

export type PublicUserSnapshot = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  updatedAt: string;
};
export type UserBatch = {
  users: PublicUserSnapshot[];
  missingIds: string[];
  asOf: string;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nullableText = (value: unknown, maximum: number) =>
  value === null || (typeof value === 'string' && value.length <= maximum);
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  isISO8601(value, { strict: true }) &&
  Number.isFinite(Date.parse(value));

@Injectable()
export class UserServiceClient {
  private readonly base: URL;
  private readonly secret: string;
  private readonly pending = new Map<string, Promise<UserBatch>>();

  constructor(@Inject(ConfigService) config: ConfigService) {
    const base = new URL(config.getOrThrow<string>('USER_SERVICE_URL'));
    const localHttp =
      base.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]', 'user-service'].includes(
        base.hostname,
      );
    if (
      (base.protocol !== 'https:' && !localHttp) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== '/'
    ) {
      throw new Error(
        'USER_SERVICE_URL must be a trusted HTTPS origin, or local/internal User service origin',
      );
    }
    const secret = config.getOrThrow<string>('INTERNAL_API_SECRET');
    if (!validInternalSecret(secret)) {
      throw new Error(
        'INTERNAL_API_SECRET must contain 32 to 256 random letters, digits, underscores or hyphens',
      );
    }
    this.base = base;
    this.secret = secret;
  }

  getUsers(ids: string[]): Promise<UserBatch> {
    const key = [...ids].sort().join(',');
    const existing = this.pending.get(key);
    if (existing) return existing;
    if (this.pending.size >= 64)
      throw new ServiceUnavailableException('User service is busy');
    const request = this.fetchUsers(ids).finally(() =>
      this.pending.delete(key),
    );
    this.pending.set(key, request);
    return request;
  }

  async assertUnblocked(a: string, b: string): Promise<void> {
    const url = new URL('/internal/blocks/check', this.base);
    url.searchParams.set('a', a);
    url.searchParams.set('b', b);
    const body = await this.fetchJson(url);
    if (!record(body) || typeof body.blocked !== 'boolean')
      throw new ServiceUnavailableException('User service is unavailable');
    if (body.blocked)
      throw new ForbiddenException('Direct messaging is blocked');
  }

  private async fetchUsers(ids: string[]): Promise<UserBatch> {
    const url = new URL('/internal/users', this.base);
    url.searchParams.set('ids', ids.join(','));
    const body = await this.fetchJson(url);
    try {
      return this.validate(body, ids);
    } catch {
      throw new ServiceUnavailableException('User service is unavailable');
    }
  }

  private async fetchJson(url: URL): Promise<unknown> {
    try {
      const response = await fetch(url, {
        headers: { 'x-internal-key': this.secret, Accept: 'application/json' },
        signal: AbortSignal.timeout(2000),
        redirect: 'error',
      });
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/json')
      ) {
        await response.body?.cancel();
        throw new Error('Invalid response');
      }
      if (!response.body) throw new Error('Missing response');
      const reader = response.body.getReader();
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 262144)
            throw new Error('Response exceeds the batch limit');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new ServiceUnavailableException('User service is unavailable');
    }
  }

  private validate(body: unknown, ids: string[]): UserBatch {
    if (!Array.isArray(body) || body.length !== ids.length)
      throw new Error('Invalid batch');
    const expected = new Set(ids);
    const seen = new Set<string>();
    const users: PublicUserSnapshot[] = [];
    const missingIds: string[] = [];
    let asOf = new Date().toISOString();
    for (const user of body) {
      if (
        !record(user) ||
        typeof user.id !== 'string' ||
        !isUUID(user.id) ||
        !expected.has(user.id) ||
        seen.has(user.id) ||
        typeof user.deleted !== 'boolean' ||
        !timestamp(user.updatedAt)
      ) {
        throw new Error('Invalid public profile');
      }
      seen.add(user.id);
      if (user.deleted) {
        if (
          user.username !== null ||
          user.displayName !== null ||
          user.avatarUrl !== null
        )
          throw new Error('Invalid tombstone');
        missingIds.push(user.id);
        asOf = user.updatedAt;
      } else {
        if (
          typeof user.username !== 'string' ||
          user.username.length < 1 ||
          user.username.length > 30 ||
          !nullableText(user.displayName, 50) ||
          !nullableText(user.avatarUrl, 2048)
        )
          throw new Error('Invalid public profile');
        users.push({
          id: user.id,
          username: user.username,
          displayName: user.displayName as string | null,
          avatarUrl: user.avatarUrl as string | null,
          updatedAt: user.updatedAt,
        });
      }
    }
    return { users, missingIds, asOf };
  }
}

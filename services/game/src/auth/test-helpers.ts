import {
  Module,
  type DynamicModule,
  type INestApplication,
  type MiddlewareConsumer,
  type NestModule,
  type Provider,
  type Type,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  AuthPrincipalClient,
  type VerifiedPrincipal,
} from "./auth-principal-client.js";

export type FakeVerify = (accessToken: string) => Promise<VerifiedPrincipal>;

/**
 * Spin up a minimal Nest app with AuthPrincipalClient overridden by a fake.
 * Single shared helper for auth-game integration tests (Tasks 4-5 add their
 * controllers/providers via `extra`). `extra.applyMiddleware` runs inside the
 * test module's `configure()` so middleware is registered before routes —
 * an `app.use()` after init would run after them.
 */
export async function createTestAppWithVerifier(
  fakeVerify: FakeVerify,
  extra: {
    controllers?: Type<unknown>[];
    providers?: Provider[];
    applyMiddleware?: (consumer: MiddlewareConsumer) => void;
  } = {},
): Promise<{ app: INestApplication; fake: AuthPrincipalClient }> {
  const fake = { verify: fakeVerify } as AuthPrincipalClient;

  @Module({})
  class VerifierTestModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
      extra.applyMiddleware?.(consumer);
    }

    static withFake(): DynamicModule {
      return {
        module: VerifierTestModule,
        controllers: extra.controllers ?? [],
        providers: [
          { provide: AuthPrincipalClient, useValue: fake },
          ...(extra.providers ?? []),
        ],
      };
    }
  }

  const app = await NestFactory.create(VerifierTestModule.withFake(), {
    logger: false,
    abortOnError: false,
  });
  await app.init();
  return { app, fake };
}

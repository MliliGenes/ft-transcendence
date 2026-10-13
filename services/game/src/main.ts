import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { Server as HttpServer } from "node:http";
import { AppModule } from "./app.module.js";
import { GameService } from "./game/game.service.js";
import { GameGateway } from "./game/game.gateway.js";
import { createRuntimeCloser } from "./runtime-close.js";
import { RuntimeAlreadyOwnedError } from "arena-game-engine/persistence";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"], abortOnError: false });
  const game = app.get(GameService);
  const close = createRuntimeCloser({
    stop: () => game.stop(),
    stopHttpAcceptance: () => {
      const http = app.getHttpServer() as HttpServer;
      if (http.listening) http.close();
    },
    disconnectSockets: () => {
      const io = app.get(GameGateway).server;
      if (!io) return; // init may fail before gateway server assignment
      for (const name of ["/", "/lobby", "/chat", "/collab"]) io.of(name).disconnectSockets(true);
    },
    closeApplication: () => app.close(),
    exit: (code) => process.exit(code),
    report: () => console.error("[game] shutdown failed"),
  });
  game.onRuntimeLoss((error) => { console.error("[game] runtime ownership lost"); void close(error); });
  process.once("SIGTERM", () => { void close(); });
  process.once("SIGINT", () => { void close(); });
  app.enableCors({ origin: true });
  try {
    await app.init();
    game.assertServing();
    await app.listen(Number(process.env.PORT ?? 3002), "0.0.0.0");
    // A loss during listen also uses the subscribed close path.
    game.assertServing();
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error(error instanceof RuntimeAlreadyOwnedError
      ? "[game] another Game runtime already owns this database" : "[game] startup failed");
    await close(failure);
  }
}
void bootstrap().catch(() => {
  console.error("[game] bootstrap failed"); process.exit(1);
});

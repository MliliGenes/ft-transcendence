import { GameRuntimeInterceptor } from "./runtime-availability.interceptor.js";
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AuthPrincipalClient } from "../auth/auth-principal-client.js";
import { GameController } from "./game.controller.js";
import { LobbyController } from "./lobby.controller.js";
import { CollabGateway } from "./collab.gateway.js";
import { GameGateway } from "./game.gateway.js";
import { LobbyGateway } from "./lobby.gateway.js";
import { TeamChatGateway } from "./team-chat.gateway.js";
import { GameService } from "./game.service.js";
import { PrincipalMiddleware } from "./principal.js";

@Module({
  controllers: [GameController, LobbyController],
  exports: [GameService],
  // AuthPrincipalClient provider registration lives here only (Task 4);
  // socket gateways (Task 5) inject it without re-registering. Factory (not
  // class) provider: the client's optional string ctor param would otherwise
  // read as a String DI token under tsc metadata.
  providers: [
    GameService,
    GameRuntimeInterceptor,
    { provide: AuthPrincipalClient, useFactory: () => new AuthPrincipalClient() },
    PrincipalMiddleware,
    GameGateway,
    CollabGateway,
    TeamChatGateway,
    LobbyGateway,
  ],
})
export class GameModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(PrincipalMiddleware)
      .forRoutes(
        { path: "matches", method: RequestMethod.ALL },
        { path: "matches/{*path}", method: RequestMethod.ALL },
        { path: "lobby", method: RequestMethod.ALL },
        { path: "lobby/{*path}", method: RequestMethod.ALL },
      );
  }
}

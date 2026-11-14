import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GameController } from './game.controller.js';
import { GameStatsController } from './game-stats.controller.js';
import { LobbyController } from './lobby.controller.js';
import { CollabGateway } from './collab.gateway.js';
import { GameGateway } from './game.gateway.js';
import { LobbyGateway } from './lobby.gateway.js';
import { TeamChatGateway } from './team-chat.gateway.js';
import { GameService } from './game.service.js';
import { ActiveAccountGuard } from './active-account.guard.js';
import { GameUserEventsConsumer } from './user-events.consumer.js';
import { GameEventsPublisher } from './game-events.publisher.js';
import { devPrincipalMiddleware } from './principal.js';

@Module({
  controllers: [GameController, GameStatsController, LobbyController],
  providers: [
    GameService,
    GameGateway,
    CollabGateway,
    TeamChatGateway,
    LobbyGateway,
    GameUserEventsConsumer,
    GameEventsPublisher,
    { provide: APP_GUARD, useClass: ActiveAccountGuard },
  ],
})
export class GameModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(devPrincipalMiddleware)
      .forRoutes(
        { path: 'matches', method: RequestMethod.ALL },
        { path: 'matches/{*path}', method: RequestMethod.ALL },
        { path: 'users/{*path}', method: RequestMethod.ALL },
        { path: 'leaderboard', method: RequestMethod.ALL },
        { path: 'lobby', method: RequestMethod.ALL },
        { path: 'lobby/{*path}', method: RequestMethod.ALL },
      );
  }
}

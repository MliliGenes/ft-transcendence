import { BadRequestException, Controller, Get, Param, Req, UseFilters } from "@nestjs/common";
import type { Request } from "express";
import { EngineErrorFilter } from "./errors.js";
import { GameService } from "./game.service.js";
import { requirePrincipal } from "./principal.js";

/** Public match summaries only; submissions, source code, and hidden tests stay private. */
@Controller()
@UseFilters(EngineErrorFilter)
export class GameStatsController {
  constructor(private readonly game: GameService) {}

  @Get("users/:userId/matches")
  userMatches(@Req() req: Request, @Param("userId") userId: string) {
    requirePrincipal(req);
    this.validateUserId(userId);
    return this.game.userMatches(userId);
  }

  @Get("users/:userId/stats")
  userStatistics(@Req() req: Request, @Param("userId") userId: string) {
    requirePrincipal(req);
    this.validateUserId(userId);
    return this.game.userStatistics(userId);
  }

  @Get("leaderboard")
  leaderboard(@Req() req: Request) {
    requirePrincipal(req);
    return this.game.leaderboard();
  }

  private validateUserId(userId: string): void {
    if (!userId || userId.length > 128) throw new BadRequestException("invalid user id");
  }
}

import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { EMPTY, of, throwError, type Observable } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { GameService } from "./game.service.js";

@Injectable()
export class GameRuntimeInterceptor implements NestInterceptor {
  // @Inject: explicit token for vitest/esbuild (drops design:paramtypes).
  constructor(@Inject(GameService) private readonly game: GameService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const socketMessage = context.getType() === "ws";
    if (socketMessage && !this.game.runtimeReady) return EMPTY;
    this.game.assertServing();
    return next.handle().pipe(mergeMap((value: unknown) => {
      if (socketMessage && !this.game.runtimeReady) return EMPTY;
      this.game.assertServing();
      return of(value);
    }), catchError((error: unknown) => {
      if (socketMessage && !this.game.runtimeReady) return EMPTY;
      this.game.assertServing();
      return throwError(() => error);
    }));
  }
}

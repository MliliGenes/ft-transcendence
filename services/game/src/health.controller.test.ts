import { expect, it, vi } from "vitest";
import { GameService } from "./game/game.service.js";
import { HealthController } from "./health.controller.js";
it("retains process liveness but rejects readiness after stop", async () => {
  vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("DEV_PRINCIPAL", "true");
  const game = new GameService();
  try {
    await game.onModuleInit(); const health = new HealthController(game);
    await game.stop();
    expect(health.health()).toMatchObject({ status: "ok" });
    await expect(health.ready()).rejects.toMatchObject({ status: 503 });
  } finally { await game.stop(); vi.unstubAllEnvs(); }
});

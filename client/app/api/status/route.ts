export interface ServiceStatus {
  name: string;
  category: "core" | "game" | "storage";
  description: string;
  status: "operational" | "degraded" | "down";
  latencyMs: number;
}

export interface PlatformStatus {
  status: "operational" | "degraded" | "outage";
  timestamp: string;
  services: ServiceStatus[];
}

export async function checkPlatformHealth(): Promise<PlatformStatus> {
  const checks: ServiceStatus[] = [];

  const targets = [
    {
      name: "Authentication & Accounts",
      category: "core" as const,
      description: "User registration, sessions, and profile management",
      url: process.env.USER_SERVICE_URL || "http://user-service:3000/",
    },
    {
      name: "Chat & Messaging",
      category: "core" as const,
      description: "Direct messaging, channels, and real-time delivery",
      url: process.env.CHAT_SERVICE_URL || "http://chat-service:3000/",
    },
    {
      name: "Code Arena Game Engine",
      category: "game" as const,
      description: "Matchmaking, live 1v1 and 2v2 sockets, and state recovery",
      url: process.env.GAME_SERVICE_URL || "http://game-service:3002/ready",
    },
    {
      name: "Media & Object Storage",
      category: "storage" as const,
      description: "Encrypted attachment hosting and presigned media delivery",
      url: process.env.MINIO_URL || "http://minio:9000/minio/health/live",
    },
  ];

  for (const target of targets) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(target.url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      checks.push({
        name: target.name,
        category: target.category,
        description: target.description,
        status: res.ok ? "operational" : "degraded",
        latencyMs,
      });
    } catch {
      checks.push({
        name: target.name,
        category: target.category,
        description: target.description,
        status: "down",
        latencyMs: Date.now() - start,
      });
    }
  }

  const allOperational = checks.every((c) => c.status === "operational");
  const anyDown = checks.some((c) => c.status === "down");

  return {
    status: allOperational ? "operational" : anyDown ? "outage" : "degraded",
    timestamp: new Date().toISOString(),
    services: checks,
  };
}

export async function GET() {
  const health = await checkPlatformHealth();
  return Response.json(health);
}

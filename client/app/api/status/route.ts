import { checkPlatformHealth } from "@/lib/platform-status";

export async function GET() {
  const health = await checkPlatformHealth();
  return Response.json(health);
}

import {
  checkServiceHealth,
  getRecentLogs,
  checkDependencies,
} from "@/lib/tools";

export async function GET() {
  // Run checks first so any errors appear in the logs we retrieve.
  const health = await checkServiceHealth();
  const dependencies = await checkDependencies();
  const logs = await getRecentLogs();

  return Response.json({
    health,
    dependencies,
    logs,
  });
}

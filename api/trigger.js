import { runPipeline } from "../lib/runPipeline.js";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const authorization = request.headers.authorization || "";
  return authorization === `Bearer ${secret}`;
}

export default async function handler(request, response) {
  if (!isAuthorized(request)) {
    return response.status(401).json({ ok: false, error: "Unauthorized" });
  }
  if (request.method !== "POST" && request.method !== "GET") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(JSON.stringify({ event: "manual_trigger_started", requestId }));
  try {
    const result = await runPipeline();
    console.log(JSON.stringify({ event: "manual_trigger_finished", requestId, ok: result.ok }));
    return response.status(result.ok ? 200 : 502).json({ requestId, ...result });
  } catch (error) {
    console.error(JSON.stringify({ event: "manual_trigger_failed", requestId, error: error.message, stack: error.stack }));
    return response.status(500).json({ ok: false, requestId, error: "Pipeline failed", message: error.message });
  }
}

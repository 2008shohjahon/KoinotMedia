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
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const requestId = `cron-${Date.now()}`;
  console.log(JSON.stringify({ event: "cron_started", requestId }));
  try {
    const result = await runPipeline();
    console.log(JSON.stringify({ event: "cron_finished", requestId, ok: result.ok, published: result.published.length }));
    return response.status(result.ok ? 200 : 502).json({ requestId, ...result });
  } catch (error) {
    console.error(JSON.stringify({ event: "cron_failed", requestId, error: error.message, stack: error.stack }));
    return response.status(500).json({ ok: false, requestId, error: "Cron pipeline failed", message: error.message });
  }
}

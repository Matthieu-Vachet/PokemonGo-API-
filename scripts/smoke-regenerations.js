const target = String(process.env.REGENERATION_SMOKE_TARGET || "https://pokemon-go-api.vercel.app").replace(/\/$/, "");
const secret = process.env.POKEMON_API_ADMIN_SECRET || process.env.API_ADMIN_SECRET || "";
const domains = [
  "pokemon-identity-mappings",
  "raids",
  "max-battles",
  "rocket",
  "pvp-rankings",
  "gbl-calendar",
  "best-attackers",
  "best-defenders",
  "eggs",
  "research",
  "shiny",
];

if (!secret) throw new Error("POKEMON_API_ADMIN_SECRET ou API_ADMIN_SECRET est requis.");

async function request(pathname, method = "POST") {
  const response = await fetch(`${target}${pathname}`, {
    method,
    headers: { accept: "application/json", "content-type": "application/json", "x-api-admin-secret": secret },
    body: method === "POST" ? "{}" : undefined,
    signal: AbortSignal.timeout(11 * 60_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(`${pathname}: HTTP ${response.status} ${payload.error?.message || payload.error || payload.message || "echec"}`);
    error.code = payload.error?.code || payload.code || null;
    error.details = payload.error?.details || payload.details || null;
    throw error;
  }
  return { status: response.status, payload };
}

function terminalRunStatus(value) {
  const status = String(value?.data?.status || value?.status || "").trim().toLowerCase();
  return ["success", "partial", "unchanged", "warning", "completed", "completed-with-warnings", "failed", "cancelled", "canceled"].includes(status)
    ? status
    : null;
}

async function waitForAcceptedRegeneration(result) {
  const accepted = result.payload?.data?.accepted === true ? result.payload.data : null;
  if (!accepted) return { ...result, runStatus: "synchronous" };
  const statusPath = String(accepted.statusPath || "");
  if (!statusPath.startsWith("/api/")) throw new Error("Régénération acceptée sans route de suivi valide.");

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const statusResult = await request(statusPath, "GET");
    const runStatus = terminalRunStatus(statusResult.payload);
    if (!runStatus) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      continue;
    }
    if (["failed", "cancelled", "canceled"].includes(runStatus)) {
      const run = statusResult.payload?.data || statusResult.payload;
      throw new Error(`${statusPath}: job ${runStatus}: ${run?.errors?.[0]?.message || "échec sans détail"}`);
    }
    return { ...statusResult, runStatus };
  }
  throw new Error(`${statusPath}: délai de suivi dépassé.`);
}

async function main() {
  const results = [];
  for (const domain of domains) {
    const startedAt = Date.now();
    try {
      const result = await waitForAcceptedRegeneration(await request(`/api/v1/admin/${domain}/regenerate`));
      results.push({ domain, success: true, status: result.status, runStatus: result.runStatus, durationMs: Date.now() - startedAt });
    } catch (error) {
      const sourceProtected = domain === "best-defenders" && error.code === "SOURCE_PROTECTED";
      results.push({
        domain,
        success: sourceProtected,
        expectedStatus: sourceProtected ? "source_protected" : undefined,
        error: error.message,
        durationMs: Date.now() - startedAt,
      });
    }
  }
  const failed = results.filter((result) => !result.success);
  console.log(JSON.stringify({ target, results, success: failed.length === 0 }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

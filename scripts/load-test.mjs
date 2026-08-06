const targetUrl = process.env.LOAD_TEST_URL || process.argv[2] || 'http://127.0.0.1/health/ready';
const concurrency = Math.max(1, Math.min(Number(process.env.LOAD_TEST_CONCURRENCY) || 20, 500));
const durationMs = Math.max(1000, (Number(process.env.LOAD_TEST_SECONDS) || 30) * 1000);
const requestTimeoutMs = Math.max(1000, Number(process.env.LOAD_TEST_TIMEOUT_MS) || 10000);
const cookie = process.env.LOAD_TEST_COOKIE;
const deadline = Date.now() + durationMs;
const latencies = [];
const statusCounts = new Map();
let failures = 0;
let bytes = 0;

async function worker() {
  while (Date.now() < deadline) {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(targetUrl, {
        headers: cookie ? { Cookie: cookie } : undefined,
        signal: controller.signal,
      });
      const body = await response.arrayBuffer();
      bytes += body.byteLength;
      statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
      if (!response.ok && response.status !== 304) failures += 1;
    } catch {
      failures += 1;
      statusCounts.set('network_error', (statusCounts.get('network_error') || 0) + 1);
    } finally {
      clearTimeout(timeout);
      latencies.push(performance.now() - startedAt);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
latencies.sort((a, b) => a - b);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
const elapsedSeconds = durationMs / 1000;

console.log(JSON.stringify({
  targetUrl,
  concurrency,
  requests: latencies.length,
  failures,
  errorRatePercent: Number(((failures / Math.max(latencies.length, 1)) * 100).toFixed(2)),
  requestsPerSecond: Number((latencies.length / elapsedSeconds).toFixed(2)),
  latencyMs: {
    p50: Number(percentile(0.50).toFixed(1)),
    p95: Number(percentile(0.95).toFixed(1)),
    p99: Number(percentile(0.99).toFixed(1)),
    max: Number((latencies.at(-1) || 0).toFixed(1)),
  },
  downloadedMegabytes: Number((bytes / 1024 / 1024).toFixed(2)),
  statuses: Object.fromEntries(statusCounts),
}, null, 2));

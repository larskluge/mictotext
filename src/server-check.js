export async function checkServer(baseUrl = 'http://localhost:50060') {
  let res;
  try {
    res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    throw new Error(`Whisper server not running at ${baseUrl}: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Whisper server not healthy: HTTP ${res.status}`);
  }

  const body = await res.json();
  if (body.status !== 'ok') {
    throw new Error(`Whisper server not healthy: status "${body.status}"`);
  }
}

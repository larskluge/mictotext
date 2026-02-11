import { DEFAULT_PORT, DEFAULT_BASE_URL } from './config.js';

export async function checkServer(baseUrl = DEFAULT_BASE_URL) {
  let res;
  try {
    res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(1000),
    });
  } catch (err) {
    throw new Error(`Whisper server not running at ${baseUrl}.\nStart it with: mictotext serve`);
  }

  if (!res.ok) {
    throw new Error(`Whisper server not healthy: HTTP ${res.status}`);
  }

  const body = await res.json();
  if (body.status !== 'ok') {
    throw new Error(`Whisper server not healthy: status "${body.status}"`);
  }
}

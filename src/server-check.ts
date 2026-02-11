import { DEFAULT_BASE_URL } from './config.ts';

export async function checkServer(baseUrl: string = DEFAULT_BASE_URL): Promise<void> {
  let res: Response;
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

  const body = await res.json() as { status: string };
  if (body.status !== 'ok') {
    throw new Error(`Whisper server not healthy: status "${body.status}"`);
  }
}

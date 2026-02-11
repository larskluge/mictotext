import fs from 'node:fs';
import { DEFAULT_BASE_URL } from './config.js';

export async function transcribe(filePath, options = {}) {
  const { baseUrl = DEFAULT_BASE_URL } = options;

  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    baseURL: `${baseUrl}/v1`,
    apiKey: 'not-needed',
  });

  const start = Date.now();

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file: fs.createReadStream(filePath),
    response_format: 'verbose_json',
  });

  const transcriptionTimeSec = (Date.now() - start) / 1000;

  return {
    text: response.text,
    language: response.language,
    durationSec: response.duration,
    transcriptionTimeSec,
  };
}

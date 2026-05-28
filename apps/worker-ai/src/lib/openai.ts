import OpenAI from 'openai';
import { loadEnv } from '../config/env.js';

let cached: OpenAI | undefined;
let injected: OpenAI | undefined;

export function getOpenAi(): OpenAI {
  if (injected) return injected;
  if (!cached) {
    const env = loadEnv();
    cached = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return cached;
}

// Test seam — replace the client with a fake.
export function __setOpenAiForTests(fake: OpenAI | undefined): void {
  injected = fake;
}

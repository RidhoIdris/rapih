import type OpenAI from 'openai';

/**
 * Scripted chunk types for the streaming chat.completions.create mock.
 * Each ScriptedTurn is the full sequence of chunks for one call to create().
 */
export type ScriptedChunk =
  | { content: string }
  | { toolCall: { id: string; name: string; argumentsJson: string } }
  | { usage: { prompt_tokens: number; completion_tokens: number } }
  | { finish: 'stop' | 'tool_calls' };

export type ScriptedTurn = ScriptedChunk[];

type CapturedCreateArgs = unknown;

/**
 * Build an OpenAI-shaped fake whose chat.completions.create yields the scripted
 * chunks as an async iterable (matches the streaming API). Multiple scripted
 * turns are supported so tool-loops can be tested across iterations.
 *
 * The returned `capturedArgs` array collects the args of every `create()` call,
 * useful for asserting prompt shape / tool definitions.
 */
export function buildOpenAiStreamMock(turns: ScriptedTurn[]): {
  client: OpenAI;
  capturedArgs: CapturedCreateArgs[];
} {
  let turnIdx = 0;
  const capturedArgs: CapturedCreateArgs[] = [];
  const client = {
    chat: {
      completions: {
        create: async (args: unknown) => {
          capturedArgs.push(args);
          const turn = turns[turnIdx++] ?? [];
          return {
            [Symbol.asyncIterator]: async function* () {
              for (const c of turn) {
                if ('content' in c) {
                  yield { choices: [{ delta: { content: c.content } }] };
                } else if ('toolCall' in c) {
                  yield {
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            {
                              index: 0,
                              id: c.toolCall.id,
                              type: 'function',
                              function: {
                                name: c.toolCall.name,
                                arguments: c.toolCall.argumentsJson,
                              },
                            },
                          ],
                        },
                      },
                    ],
                  };
                } else if ('usage' in c) {
                  yield { choices: [{ delta: {} }], usage: c.usage };
                } else if ('finish' in c) {
                  yield { choices: [{ delta: {}, finish_reason: c.finish }] };
                }
              }
            },
          };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, capturedArgs };
}

/**
 * Non-streaming variant — for handlers like ai.ocr-receipt that call without
 * stream: true. Returns a single object shaped like a non-stream completion.
 */
export function buildOpenAiCompletionMock(
  scriptedReplies: {
    content: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  }[]
): OpenAI {
  let i = 0;
  return {
    chat: {
      completions: {
        create: async () => {
          const r = scriptedReplies[i++] ?? scriptedReplies[scriptedReplies.length - 1];
          if (!r) throw new Error('no scripted reply');
          return {
            choices: [{ message: { role: 'assistant', content: r.content } }],
            usage: { ...r.usage, total_tokens: r.usage.prompt_tokens + r.usage.completion_tokens },
          };
        },
      },
    },
  } as unknown as OpenAI;
}

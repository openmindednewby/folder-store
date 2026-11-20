import { describe, expect, it } from 'vitest';

import { answerWithin } from './answerWithin';

describe('answerWithin', () => {
  it('with work that never settles, resolves with the fallback after the limit', async () => {
    const work = new Promise<string>(() => undefined);

    const result = await answerWithin(work, 10, 'late');

    expect(result).toBe('late');
  });

  it('with work that settles in time, resolves with its result', async () => {
    const work = Promise.resolve('done');

    const result = await answerWithin(work, 1000, 'late');

    expect(result).toBe('done');
  });

  it('with no limit, waits for the work', async () => {
    const work = Promise.resolve('done');

    const result = await answerWithin(work, undefined, 'late');

    expect(result).toBe('done');
  });

  it('with work that fails in time, rejects with its error', async () => {
    const work = Promise.reject(new Error('broken'));

    const result = answerWithin(work, 1000, 'late');

    await expect(result).rejects.toThrow('broken');
  });
});

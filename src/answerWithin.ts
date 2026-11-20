/** Resolves with the work's result, or with the fallback when the work has not settled within the time limit. */
export async function answerWithin<T>(work: Promise<T>, timeoutMs: number | undefined, fallback: T): Promise<T> {
  if (timeoutMs === undefined) {
    return work;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

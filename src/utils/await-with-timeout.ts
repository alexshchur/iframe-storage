export async function awaitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => T | Promise<T>
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      try {
        if (!onTimeout) {
          reject(new Error("Operation timed out."));
          return;
        }

        const result = onTimeout();
        resolve(result as T);
      } catch (error) {
        reject(error);
      }
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (typeof timeoutId !== "undefined") {
      clearTimeout(timeoutId);
    }
  });
}

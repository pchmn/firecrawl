interface RetryConfig {
  maxRetry: number;
  retryInterval: number;
  timeout: number;
  functionName: string;
  onError?: (error: any) => void;
}

export const retry = async <T>(
  fn: ({ remainingTimeout }: { remainingTimeout: number }) => Promise<T> | T,
  config: RetryConfig,
  retryCount = 0,
  remainingTimeout = config.timeout
): Promise<T> => {
  const startTime = Date.now();
  const { maxRetry, retryInterval, functionName, onError } = config;

  try {
    const res = await fn({ remainingTimeout });
    return res;
  } catch (error: any) {
    if (retryCount >= maxRetry) {
      const fnName = fn.name || functionName || "Anonymous function";
      throw new Error(
        `"${fnName}" failed after ${retryCount * retryInterval}s: ${
          error.message
        }`
      );
    }
    onError?.(error);
    await new Promise((resolve) => setTimeout(resolve, retryInterval));
    console.log(`Retrying ${fn.name}...`);
    return retry(
      fn,
      config,
      retryCount + 1,
      remainingTimeout - (Date.now() - startTime)
    );
  }
};

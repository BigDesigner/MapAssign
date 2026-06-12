export async function isRateLimited(
  kv: KVNamespace,
  ip: string,
  limit = 20,
  periodSeconds = 60
): Promise<boolean> {
  const currentWindow = Math.floor(Date.now() / (periodSeconds * 1000));
  const key = `ratelimit:${ip}:${currentWindow}`;
  
  const countStr = await kv.get(key);
  let count = 0;
  
  if (countStr) {
    count = parseInt(countStr, 10);
  }
  
  if (count >= limit) {
    return true;
  }
  
  count++;
  await kv.put(key, count.toString(), {
    expirationTtl: periodSeconds
  });
  
  return false;
}

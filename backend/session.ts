export interface SessionData {
  role: 'admin' | 'representative';
  id?: number;
  createdAt: number;
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(
  kv: KVNamespace,
  role: 'admin' | 'representative',
  id?: number
): Promise<string> {
  const token = generateSessionToken();
  const sessionData: SessionData = {
    role,
    id,
    createdAt: Date.now()
  };
  
  // Set in KV with 4 hours TTL (14400 seconds)
  await kv.put(`session:${token}`, JSON.stringify(sessionData), {
    expirationTtl: 14400
  });
  
  return token;
}

export async function getSession(
  kv: KVNamespace,
  token: string
): Promise<SessionData | null> {
  if (!token) return null;
  
  const data = await kv.get(`session:${token}`);
  if (!data) return null;
  
  try {
    const sessionData: SessionData = JSON.parse(data);
    
    // Sliding window: refresh TTL by writing it back with a fresh 4-hour expiration
    await kv.put(`session:${token}`, data, {
      expirationTtl: 14400
    });
    
    return sessionData;
  } catch {
    return null;
  }
}

export async function destroySession(kv: KVNamespace, token: string): Promise<void> {
  if (token) {
    await kv.delete(`session:${token}`);
  }
}

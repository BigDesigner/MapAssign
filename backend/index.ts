import { verifyAdminPassword, verifyPassword, hashPassword } from './auth';
import { createSession, getSession, destroySession, SessionData } from './session';
import { isRateLimited } from './rateLimit';
import { isValidCountryCode, isValidColorHex, sanitizeInput } from './validation';

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD_HASH?: string;
  ALLOWED_ORIGIN?: string;
}

function getAllowedOrigins(env: Env): string[] {
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://map.akansu.com',
    'https://mapassign.pages.dev'
  ];
  if (env.ALLOWED_ORIGIN) {
    const dynamics = env.ALLOWED_ORIGIN.split(',').map(o => o.trim());
    return [...defaults, ...dynamics];
  }
  return defaults;
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env);
  
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length === 2) {
      cookies[parts[0].trim()] = parts[1].trim();
    }
  });
  
  return cookies;
}

async function getAuthenticatedSession(
  request: Request,
  env: Env
): Promise<SessionData | null> {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies['session'];
  if (!token) return null;
  return getSession(env.SESSIONS, token);
}

function jsonResponse(data: any, status = 200, headers?: Headers): Response {
  const resHeaders = headers || new Headers();
  resHeaders.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), {
    status,
    headers: resHeaders
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const headers = corsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // IP-based Rate Limiter (for state-changing endpoints)
    const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    if (request.method === 'POST') {
      const limited = await isRateLimited(env.SESSIONS, ip, 40, 60);
      if (limited) {
        return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429, headers);
      }

      // CSRF Protection: Verify Origin/Referer for POST requests against allowed origins list
      const origin = request.headers.get('Origin') || request.headers.get('Referer');
      const allowedOrigins = getAllowedOrigins(env);
      if (origin) {
        const isValid = allowedOrigins.some(allowed => origin.startsWith(allowed));
        if (!isValid) {
          return jsonResponse({ error: 'CSRF validation failed: Origin not allowed.' }, 403, headers);
        }
      }
    }

    try {
      // 1. POST /api/auth/login
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body: any = await request.json();
        const usernameOrCode = body.usernameOrCode;
        const password = body.password;

        if (!usernameOrCode || !password) {
          return jsonResponse({ error: 'Credentials required.' }, 400, headers);
        }

        // Check Admin Role
        const expectedAdminUser = env.ADMIN_USERNAME || 'admin';
        const expectedAdminHash = env.ADMIN_PASSWORD_HASH;

        if (usernameOrCode === expectedAdminUser && expectedAdminHash) {
          const isValid = await verifyAdminPassword(password, expectedAdminHash);
          if (isValid) {
            const token = await createSession(env.SESSIONS, 'admin');
            headers.append('Set-Cookie', `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=14400`);
            return jsonResponse({ success: true, role: 'admin' }, 200, headers);
          }
        }

        // Check Representative Role
        const rep = await env.DB.prepare(
          'SELECT id, password_hash, name FROM representatives WHERE representative_code = ?'
        )
          .bind(usernameOrCode)
          .first<{ id: number; password_hash: string; name: string }>();

        if (rep) {
          const isValid = await verifyPassword(password, rep.password_hash);
          if (isValid) {
            const token = await createSession(env.SESSIONS, 'representative', rep.id);
            headers.append('Set-Cookie', `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=14400`);
            return jsonResponse({ success: true, role: 'representative', name: rep.name }, 200, headers);
          }
        }

        return jsonResponse({ error: 'Invalid username/code or password.' }, 401, headers);
      }

      // 2. POST /api/auth/logout
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        const cookies = parseCookies(request.headers.get('Cookie'));
        const token = cookies['session'];
        if (token) {
          await destroySession(env.SESSIONS, token);
        }
        headers.append('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
        return jsonResponse({ success: true }, 200, headers);
      }

      // Authenticate session for subsequent requests
      const session = await getAuthenticatedSession(request, env);
      if (!session) {
        return jsonResponse({ error: 'Unauthorized session.' }, 401, headers);
      }

      // 3. GET /api/map/state
      if (url.pathname === '/api/map/state' && request.method === 'GET') {
        // Available for both admin and representatives (representatives read-only, but let's keep it secure)
        // Admin gets the whole state with representatives list
        if (session.role !== 'admin') {
          return jsonResponse({ error: 'Forbidden. Admin role required.' }, 403, headers);
        }

        const assignments = await env.DB.prepare(
          `SELECT ca.country_code, ca.representative_id, r.name, r.color_hex 
           FROM country_assignments ca 
           JOIN representatives r ON ca.representative_id = r.id`
        ).all();

        return jsonResponse({ assignments: assignments.results }, 200, headers);
      }

      // 4. GET /api/representative/state
      if (url.pathname === '/api/representative/state' && request.method === 'GET') {
        if (session.role !== 'representative' || !session.id) {
          return jsonResponse({ error: 'Forbidden. Representative role required.' }, 403, headers);
        }

        const repDetails = await env.DB.prepare(
          'SELECT name, color_hex FROM representatives WHERE id = ?'
        )
          .bind(session.id)
          .first<{ name: string; color_hex: string }>();

        if (!repDetails) {
          return jsonResponse({ error: 'Representative not found.' }, 404, headers);
        }

        const assignments = await env.DB.prepare(
          'SELECT country_code FROM country_assignments WHERE representative_id = ?'
        )
          .bind(session.id)
          .all();

        const countryCodes = assignments.results.map(row => row.country_code);

        return jsonResponse({
          name: repDetails.name,
          colorHex: repDetails.color_hex,
          assignedCountries: countryCodes
        }, 200, headers);
      }

      // 4.1 POST /api/representative/change-password
      if (url.pathname === '/api/representative/change-password' && request.method === 'POST') {
        if (session.role !== 'representative' || !session.id) {
          return jsonResponse({ error: 'Forbidden. Representative role required.' }, 403, headers);
        }

        const body: any = await request.json();
        const { oldPassword, newPassword } = body;

        if (!oldPassword || !newPassword) {
          return jsonResponse({ error: 'Old and new passwords are required.' }, 400, headers);
        }

        // Fetch representative details to verify old password
        const rep = await env.DB.prepare(
          'SELECT password_hash FROM representatives WHERE id = ?'
        )
          .bind(session.id)
          .first<{ password_hash: string }>();

        if (!rep) {
          return jsonResponse({ error: 'Representative not found.' }, 404, headers);
        }

        const isValid = await verifyPassword(oldPassword, rep.password_hash);
        if (!isValid) {
          return jsonResponse({ error: 'Incorrect old password.' }, 400, headers);
        }

        const newHash = await hashPassword(newPassword);

        await env.DB.prepare(
          'UPDATE representatives SET password_hash = ? WHERE id = ?'
        )
          .bind(newHash, session.id)
          .run();

        return jsonResponse({ success: true, message: 'Password changed successfully.' }, 200, headers);
      }

      // 5. POST /api/admin/assign
      if (url.pathname === '/api/admin/assign' && request.method === 'POST') {
        if (session.role !== 'admin') {
          return jsonResponse({ error: 'Forbidden. Admin role required.' }, 403, headers);
        }

        const body: any = await request.json();
        const countryCode = body.country_code;
        const representativeId = body.representative_id; // number or null to remove

        if (!countryCode || !isValidCountryCode(countryCode)) {
          return jsonResponse({ error: 'Invalid country code format.' }, 400, headers);
        }

        if (representativeId === null || representativeId === 0) {
          // Delete assignment
          await env.DB.prepare('DELETE FROM country_assignments WHERE country_code = ?')
            .bind(countryCode.toLowerCase())
            .run();
          return jsonResponse({ success: true, message: 'Assignment cleared.' }, 200, headers);
        } else {
          // Verify representative exists
          const repExists = await env.DB.prepare('SELECT id FROM representatives WHERE id = ?')
            .bind(representativeId)
            .first();

          if (!repExists) {
            return jsonResponse({ error: 'Representative not found.' }, 404, headers);
          }

          // Idempotent Upsert
          await env.DB.prepare(
            `INSERT INTO country_assignments (country_code, representative_id) 
             VALUES (?, ?) 
             ON CONFLICT(country_code) 
             DO UPDATE SET representative_id = excluded.representative_id`
          )
            .bind(countryCode.toLowerCase(), representativeId)
            .run();

          return jsonResponse({ success: true, message: 'Assignment updated.' }, 200, headers);
        }
      }

      // 6. POST /api/admin/representatives
      if (url.pathname === '/api/admin/representatives' && request.method === 'POST') {
        if (session.role !== 'admin') {
          return jsonResponse({ error: 'Forbidden. Admin role required.' }, 403, headers);
        }

        const body: any = await request.json();
        const action = body.action;

        if (action === 'create') {
          const { code, name, color, password } = body;
          
          if (!code || !name || !color || !password) {
            return jsonResponse({ error: 'Missing representative parameters.' }, 400, headers);
          }

          if (!isValidColorHex(color)) {
            return jsonResponse({ error: 'Invalid hex color format.' }, 400, headers);
          }

          const cleanCode = sanitizeInput(code.trim());
          const cleanName = sanitizeInput(name.trim());
          
          const passwordHash = await verifyAdminPassword(password, password) // just generate using our PBKDF2 pipeline
            ? '' // dummy line
            : await import('./auth').then(m => m.hashPassword(password));

          try {
            await env.DB.prepare(
              `INSERT INTO representatives (representative_code, name, color_hex, password_hash) 
               VALUES (?, ?, ?, ?)`
            )
              .bind(cleanCode, cleanName, color, passwordHash)
              .run();

            return jsonResponse({ success: true, message: 'Representative created.' }, 201, headers);
          } catch (e: any) {
            if (e.message && e.message.includes('UNIQUE')) {
              return jsonResponse({ error: 'Representative code already exists.' }, 409, headers);
            }
            return jsonResponse({ error: 'Database error occurred.' }, 500, headers);
          }
        } 
        
        else if (action === 'update') {
          const { id, name, color, password } = body;

          if (!id || !name || !color) {
            return jsonResponse({ error: 'Missing representative parameters.' }, 400, headers);
          }

          if (!isValidColorHex(color)) {
            return jsonResponse({ error: 'Invalid hex color format.' }, 400, headers);
          }

          const cleanName = sanitizeInput(name.trim());

          try {
            if (password && password.trim() !== '') {
              const passwordHash = await import('./auth').then(m => m.hashPassword(password));
              await env.DB.prepare(
                'UPDATE representatives SET name = ?, color_hex = ?, password_hash = ? WHERE id = ?'
              )
                .bind(cleanName, color, passwordHash, id)
                .run();
            } else {
              await env.DB.prepare(
                'UPDATE representatives SET name = ?, color_hex = ? WHERE id = ?'
              )
                .bind(cleanName, color, id)
                .run();
            }

            return jsonResponse({ success: true, message: 'Representative updated.' }, 200, headers);
          } catch (e: any) {
            return jsonResponse({ error: 'Database error occurred: ' + e.message }, 500, headers);
          }
        }
        
        else if (action === 'list') {
          const reps = await env.DB.prepare(
            'SELECT id, representative_code, name, color_hex, created_at FROM representatives ORDER BY name ASC'
          ).all();
          return jsonResponse({ representatives: reps.results }, 200, headers);
        } 
        
        else if (action === 'delete') {
          const id = body.id;
          if (!id) {
            return jsonResponse({ error: 'Representative ID required.' }, 400, headers);
          }

          await env.DB.prepare('DELETE FROM representatives WHERE id = ?')
            .bind(id)
            .run();

          return jsonResponse({ success: true, message: 'Representative deleted.' }, 200, headers);
        }

        return jsonResponse({ error: 'Unsupported action.' }, 400, headers);
      }

      return jsonResponse({ error: 'Not Found.' }, 404, headers);
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Internal Server Error.' }, 500, headers);
    }
  }
};

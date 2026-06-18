import { webcrypto } from 'node:crypto';

const subtle = (webcrypto as any)?.subtle || globalThis.crypto?.subtle;

if (!subtle) {
  console.error('WebCrypto API is not supported in this environment.');
  process.exit(1);
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Generate 16-byte random salt
  const salt = new Uint8Array(16);
  (webcrypto as any).getRandomValues(salt);

  const baseKey = await subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  const saltString = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashString = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `600000:${saltString}:${hashString}`;
}

const args = process.argv.slice(2);
const password = args[0];

if (!password) {
  console.log('Usage: npx ts-node scripts/hash-password.ts <password>');
  process.exit(1);
}

hashPassword(password)
  .then(hash => {
    console.log('\n--- Generated Password Hash ---');
    console.log(hash);
    console.log('--------------------------------\n');
    console.log('Copy the hash above and set it as ADMIN_PASSWORD_HASH in your Cloudflare Secrets.');
  })
  .catch(err => {
    console.error('Error generating hash:', err);
    process.exit(1);
  });

// Dev only: creates a local RSA key pair that stands in for LOS's real key.
// chat_backend verifies with keys/dev-los-public.pem (LOS_PUBLIC_KEY_PATH); dev-token.ts signs with the private one.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const dir = 'keys';
const privatePath = `${dir}/dev-los-private.pem`;
const publicPath = `${dir}/dev-los-public.pem`;

if (existsSync(privatePath) && !process.argv.includes('--force')) {
  process.stdout.write(`${privatePath} already exists (pass --force to replace it)\n`);
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
mkdirSync(dir, { recursive: true });
writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }));
process.stdout.write(`Wrote ${privatePath} and ${publicPath}\n`);

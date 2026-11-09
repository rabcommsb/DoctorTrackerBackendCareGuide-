import crypto from 'node:crypto';

/**
 * Generates 256-bit (32-byte) high-entropy secrets for JWT_SECRET and JWT_REFRESH_SECRET
 * using Node.js native CSPRNG (`node:crypto`).
 */
export const generate256BitSecret = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('# Generated 256-bit (64 hex char) High-Entropy Secrets (RFC 7519):');
  console.log(`JWT_SECRET=${generate256BitSecret()}`);
  console.log(`JWT_REFRESH_SECRET=${generate256BitSecret()}`);
}

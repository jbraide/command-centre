import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const hex = process.env.API_KEY_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('Missing API_KEY_ENCRYPTION_KEY environment variable');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptApiKey(plaintext: string): {
  encryptedKey: string;
  iv: string;
} {
  const KEY = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    encryptedKey: `${encrypted}.${authTag}`,
    iv: iv.toString('hex'),
  };
}

export function decryptApiKey(
  encryptedKey: string,
  iv: string
): string {
  const KEY = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(iv, 'hex')
  );
  const [encrypted, authTag] = encryptedKey.split('.');
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

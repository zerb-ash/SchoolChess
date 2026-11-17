import { hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

// Dummy pre-hashed string used to equalize timing side-channels when a username does not exist
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlzYWx0MTIzNDU2Nw$q6VdF9gW1vP1vGZfI9O3B2Q0A7xL8e9m0Z1w2E3r4T5';

export async function hashPassword(password: string): Promise<string> {
  if (password.length > 72) {
    throw new Error('Password exceeds maximum allowed 72 bytes.');
  }
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (password.length > 72) {
    return false;
  }
  try {
    return await verify(storedHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export async function runDummyHashVerification(): Promise<void> {
  try {
    await verify(DUMMY_HASH, 'dummy_password', ARGON2_OPTIONS);
  } catch {
    // Suppress dummy comparison errors
  }
}

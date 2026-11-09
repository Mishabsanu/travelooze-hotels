import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

const scrypt = promisify(scryptCb) as (pwd: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Stored as "scrypt$<saltHex>$<hashHex>". */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored?: string): Promise<boolean> {
  if (!stored) return false;

  // Support existing bcrypt hashes from the production database ($2a$, $2b$, $2y$)
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    try {
      return await bcrypt.compare(plain, stored);
    } catch {
      return false;
    }
  }

  // Support scrypt hashes
  if (stored.startsWith("scrypt$")) {
    const [, saltHex, hashHex] = stored.split("$");
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(plain, Buffer.from(saltHex, "hex"), expected.length);
    return timingSafeEqual(actual, expected);
  }

  return false;
}


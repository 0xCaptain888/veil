import { keccak_256 } from '@noble/hashes/sha3';

/** keccak256 of a utf-8 string — matches Move's sui::hash::keccak256. */
export function idHash(secret: string): Uint8Array {
  return keccak_256(new TextEncoder().encode(secret));
}

/** Cryptographically-random one-time claim secret. */
export function randomSecret(): string {
  // Available in Node 19+ and browsers.
  return `${crypto.randomUUID()}.${crypto.randomUUID()}`;
}

export function toByteArray(u8: Uint8Array): number[] {
  return Array.from(u8);
}

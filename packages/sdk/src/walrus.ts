/**
 * Walrus + Seal adapter for encrypted payslip storage (§12, §W5).
 *
 * Walrus: decentralized storage for encrypted payslip blobs.
 * Seal: threshold access control — payslips can only be decrypted by
 *       authorized parties (recipient, auditor) under defined conditions.
 *
 * FALLBACK MODE (current): encrypts with a simple AES-GCM key derived from
 * the employer's auditor_pubkey. Blobs are stored in-memory/local storage.
 *
 * PRODUCTION MODE (W5): publish blobs to Walrus publisher, set Seal access
 * policies for recipient + auditor keys.
 */

// ===== Types =====

export interface WalrusConfig {
  publisherUrl: string;
  /** Seal object ID for access control */
  sealObjectId?: string;
}

export interface EncryptedBlob {
  /** Walrus blob ID (or local storage key in fallback mode) */
  blobId: string;
  /** Encryption algorithm used */
  algorithm: string;
  /** Seal access policy (in production) */
  accessPolicy?: SealAccessPolicy;
  /** Timestamp of creation */
  createdAt: number;
}

export interface SealAccessPolicy {
  /** Addresses that can decrypt */
  authorizedAddresses: string[];
  /** Optional: time-based unlock */
  unlockAfterMs?: number;
  /** Optional: condition-based unlock */
  condition?: string;
}

// ===== Fallback: In-memory blob store =====

const blobStore = new Map<string, Uint8Array>();
let blobCounter = 0;

// ===== Encryption helpers =====

/**
 * Derive an encryption key from a passphrase (auditor_pubkey or shared secret).
 * Uses PBKDF2 in production; simplified for demo.
 */
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('veil-payslip-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt data with AES-GCM.
 */
export async function encryptBlob(
  data: Uint8Array,
  passphrase: string,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const key = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data),
  );

  return { ciphertext, iv };
}

/**
 * Decrypt data with AES-GCM.
 */
export async function decryptBlob(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  const key = await deriveKey(passphrase);

  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext),
  );

  return plaintext;
}

// ===== Walrus publish / retrieve =====

/**
 * Publish an encrypted blob to Walrus (or fallback local storage).
 *
 * @param data - The plaintext data to encrypt and store
 * @param passphrase - Encryption key (auditor_pubkey or shared secret)
 * @param config - Walrus configuration (if null, uses fallback storage)
 * @returns EncryptedBlob reference (blob ID for later retrieval)
 */
export async function publishBlob(
  data: Uint8Array,
  passphrase: string,
  config?: WalrusConfig,
): Promise<EncryptedBlob> {
  const { ciphertext, iv } = await encryptBlob(data, passphrase);

  // Combine IV + ciphertext for storage
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);

  if (config?.publisherUrl) {
    // ===== PRODUCTION MODE: publish to Walrus =====
    try {
      const response = await fetch(`${config.publisherUrl}/v1/blobs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: combined,
      });

      if (response.ok) {
        const result = await response.json() as any;
        return {
          blobId: result.blobId || result.id,
          algorithm: 'AES-256-GCM',
          createdAt: Date.now(),
          accessPolicy: config.sealObjectId
            ? { authorizedAddresses: [], }
            : undefined,
        };
      }
    } catch (err) {
      console.warn('[walrus] Publish failed, falling back to local storage:', err);
    }
  }

  // ===== FALLBACK MODE: local in-memory storage =====
  const blobId = `local-blob-${++blobCounter}`;
  blobStore.set(blobId, combined);

  return {
    blobId,
    algorithm: 'AES-256-GCM',
    createdAt: Date.now(),
  };
}

/**
 * Retrieve and decrypt a blob from Walrus (or fallback local storage).
 *
 * @param blobId - The blob ID returned from publishBlob
 * @param passphrase - Decryption key (must match the one used for encryption)
 * @param config - Walrus configuration (if null, uses fallback storage)
 * @returns The decrypted plaintext data
 */
export async function retrieveBlob(
  blobId: string,
  passphrase: string,
  config?: WalrusConfig,
): Promise<Uint8Array> {
  let combined: Uint8Array;

  if (config?.publisherUrl && !blobId.startsWith('local-blob-')) {
    // ===== PRODUCTION MODE: retrieve from Walrus =====
    try {
      const response = await fetch(`${config.publisherUrl}/v1/blobs/${blobId}`);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        combined = new Uint8Array(buffer);
      } else {
        throw new Error(`Walrus fetch failed: ${response.status}`);
      }
    } catch (err) {
      console.warn('[walrus] Retrieve failed, trying local fallback:', err);
      combined = blobStore.get(blobId) ?? new Uint8Array();
    }
  } else {
    // ===== FALLBACK MODE: local in-memory storage =====
    combined = blobStore.get(blobId) ?? new Uint8Array();
  }

  if (combined.length === 0) {
    throw new Error(`Blob not found: ${blobId}`);
  }

  // Extract IV (first 12 bytes) and ciphertext (rest)
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  return decryptBlob(ciphertext, iv, passphrase);
}

/**
 * Check if Walrus is configured and available.
 */
export function isWalrusAvailable(config?: WalrusConfig): boolean {
  return !!config?.publisherUrl;
}

/**
 * Build a Seal access policy for a payslip.
 * In production, this creates an on-chain access control object.
 */
export function buildSealPolicy(
  recipientAddress: string,
  auditorAddress: string,
  unlockAfterMs?: number,
): SealAccessPolicy {
  return {
    authorizedAddresses: [recipientAddress, auditorAddress],
    unlockAfterMs,
  };
}

// Memory cache for derived CryptoKey to ensure optimal performance
let cachedCryptoKey: { key: CryptoKey; id: string; master: string } | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

function base64ToBytes(base64: string): Uint8Array {
  const binary =
    typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function deriveAesKey(masterKey: string, familyId: string): Promise<CryptoKey> {
  const cleanKey = masterKey.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cachedCryptoKey && cachedCryptoKey.id === familyId && cachedCryptoKey.master === cleanKey) {
    return cachedCryptoKey.key;
  }

  const subtle = typeof window !== 'undefined' && window.crypto ? window.crypto.subtle : globalThis.crypto.subtle;
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(cleanKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = enc.encode(`FP-SALT:${familyId.toUpperCase()}`);

  const aesKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedCryptoKey = { key: aesKey, id: familyId, master: cleanKey };
  return aesKey;
}

export async function encryptPayload(payload: any, masterKey: string, familyId: string): Promise<string> {
  const aesKey = await deriveAesKey(masterKey, familyId);
  const iv = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(iv);
  } else {
    globalThis.crypto.getRandomValues(iv);
  }

  const jsonStr = JSON.stringify(payload);
  const enc = new TextEncoder();
  const subtle = typeof window !== 'undefined' && window.crypto ? window.crypto.subtle : globalThis.crypto.subtle;
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    aesKey,
    enc.encode(jsonStr)
  );

  const ivB64 = bytesToBase64(iv);
  const cipherB64 = bytesToBase64(new Uint8Array(cipherBuffer));
  return `v1:${ivB64}:${cipherB64}`;
}

export async function decryptPayload<T>(serialized: string, masterKey: string, familyId: string): Promise<T> {
  if (!serialized || !serialized.startsWith('v1:')) {
    throw new Error('Formato cifrado inválido');
  }

  const parts = serialized.split(':');
  if (parts.length !== 3) {
    throw new Error('Estrutura de dados cifrados corrompida');
  }

  const aesKey = await deriveAesKey(masterKey, familyId);
  const iv = base64ToBytes(parts[1]);
  const cipherBytes = base64ToBytes(parts[2]);

  const subtle = typeof window !== 'undefined' && window.crypto ? window.crypto.subtle : globalThis.crypto.subtle;
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    aesKey,
    cipherBytes as any
  );

  const dec = new TextDecoder();
  const jsonStr = dec.decode(decryptedBuffer);
  return JSON.parse(jsonStr) as T;
}

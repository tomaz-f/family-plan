import { AppSettings, AppState, Category, CreditCard, FuelLog, RecurringTemplate, Transaction } from '../types';

const STORAGE_MASTER_KEY = 'familyplan_master_key';
const KEY_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function getStoredMasterKey(): string | null {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const queryKey = params.get('key') || params.get('masterKey');
      if (queryKey) {
        const sanitized = sanitizeMasterKey(queryKey);
        if (sanitized) {
          localStorage.setItem(STORAGE_MASTER_KEY, sanitized);
          // Scrub sensitive master key from browser address bar & history
          params.delete('key');
          params.delete('masterKey');
          const remainingQuery = params.toString() ? `?${params.toString()}` : '';
          const cleanUrl = `${window.location.pathname}${remainingQuery}${window.location.hash}`;
          window.history.replaceState({}, document.title, cleanUrl);
          return sanitized;
        }
      }
    }
    const raw = localStorage.getItem(STORAGE_MASTER_KEY);
    return raw ? sanitizeMasterKey(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredMasterKey(masterKey: string): void {
  try {
    const sanitized = sanitizeMasterKey(masterKey);
    if (sanitized) {
      localStorage.setItem(STORAGE_MASTER_KEY, sanitized);
    }
  } catch {
    // ignore
  }
}

export function clearStoredMasterKey(): void {
  try {
    localStorage.removeItem(STORAGE_MASTER_KEY);
  } catch {
    // ignore
  }
}

export function sanitizeMasterKey(input: string): string {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/[^2-9A-HJ-NP-Z]/g, '')
    .slice(0, 12);

  // Group into XXXX-XXXX-XXXX
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join('-');
}

export function generateMasterKey(): string {
  const bytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 12; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = '';
  for (let i = 0; i < 12; i++) {
    code += KEY_CHARSET[bytes[i] % KEY_CHARSET.length];
  }

  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

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

// =========================================================
// ENTITY HELPERS (ENCRYPT BEFORE SERVER / DECRYPT ON ARRIVAL)
// =========================================================

export async function encryptTransaction(
  tx: Transaction,
  masterKey: string,
  familyId: string
): Promise<{
  id: string;
  type: string;
  date: string;
  status: string;
  createdAt: string;
  cardId?: string | null;
  invoiceMonth?: string | null;
  purchaseDate?: string | null;
  settledInvoiceKey?: string | null;
  dueDay?: number | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  totalPurchaseAmount?: number | null;
  recurringId?: string | null;
  iv: string;
  payload: string;
  encrypted_data: string;
}> {
  const sensitive = {
    amount: tx.amount,
    description: tx.description,
    categoryId: tx.categoryId,
    notes: tx.notes || '',
    recurringId: tx.recurringId || null,
    dueDay: tx.dueDay || null,
    installmentCurrent: tx.installmentCurrent || null,
    installmentTotal: tx.installmentTotal || null,
    totalPurchaseAmount: tx.totalPurchaseAmount || null,
    cardId: tx.cardId || null,
    invoiceMonth: tx.invoiceMonth || null,
    purchaseDate: tx.purchaseDate || null,
    settledInvoiceKey: tx.settledInvoiceKey || null,
  };

  const encrypted_data = await encryptPayload(sensitive, masterKey, familyId);
  const parts = encrypted_data.split(':');
  const iv = parts[1] || '';
  const payload = parts[2] || '';

  return {
    id: tx.id,
    type: tx.type,
    date: tx.date,
    status: tx.status || 'paid',
    createdAt: tx.createdAt || new Date().toISOString(),
    cardId: tx.cardId || null,
    invoiceMonth: tx.invoiceMonth || null,
    purchaseDate: tx.purchaseDate || null,
    settledInvoiceKey: tx.settledInvoiceKey || null,
    dueDay: tx.dueDay ? Number(tx.dueDay) : null,
    installmentCurrent: tx.installmentCurrent ? Number(tx.installmentCurrent) : null,
    installmentTotal: tx.installmentTotal ? Number(tx.installmentTotal) : null,
    totalPurchaseAmount: tx.totalPurchaseAmount ? Number(tx.totalPurchaseAmount) : null,
    recurringId: tx.recurringId || null,
    iv,
    payload,
    encrypted_data,
  };
}

export async function decryptTransaction(
  raw: any,
  masterKey: string,
  familyId: string
): Promise<Transaction> {
  const encData = raw.encrypted_data || (raw.iv && raw.payload ? `v1:${raw.iv}:${raw.payload}` : null);
  if (!encData) {
    // Fallback for unencrypted legacy rows
    return {
      id: raw.id,
      type: raw.type,
      amount: Number(raw.amount || 0),
      description: raw.description || '',
      categoryId: raw.categoryId || '',
      date: raw.date || '',
      notes: raw.notes || '',
      recurringId: raw.recurringId || null,
      dueDay: raw.dueDay ? Number(raw.dueDay) : null,
      installmentCurrent: raw.installmentCurrent ? Number(raw.installmentCurrent) : null,
      installmentTotal: raw.installmentTotal ? Number(raw.installmentTotal) : null,
      totalPurchaseAmount: raw.totalPurchaseAmount ? Number(raw.totalPurchaseAmount) : null,
      status: raw.status || 'paid',
      cardId: raw.cardId || null,
      invoiceMonth: raw.invoiceMonth || null,
      purchaseDate: raw.purchaseDate || null,
      settledInvoiceKey: raw.settledInvoiceKey || null,
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  }

  try {
    const sensitive = await decryptPayload<any>(encData, masterKey, familyId);
    return {
      id: raw.id,
      type: raw.type,
      status: raw.status || 'paid',
      date: raw.date,
      createdAt: raw.createdAt,
      amount: Number(sensitive.amount || 0),
      description: sensitive.description || '',
      categoryId: sensitive.categoryId || '',
      notes: sensitive.notes || '',
      recurringId: sensitive.recurringId || raw.recurringId || null,
      dueDay: sensitive.dueDay ? Number(sensitive.dueDay) : raw.dueDay ? Number(raw.dueDay) : null,
      installmentCurrent: sensitive.installmentCurrent
        ? Number(sensitive.installmentCurrent)
        : raw.installmentCurrent
        ? Number(raw.installmentCurrent)
        : null,
      installmentTotal: sensitive.installmentTotal
        ? Number(sensitive.installmentTotal)
        : raw.installmentTotal
        ? Number(raw.installmentTotal)
        : null,
      totalPurchaseAmount: sensitive.totalPurchaseAmount
        ? Number(sensitive.totalPurchaseAmount)
        : raw.totalPurchaseAmount
        ? Number(raw.totalPurchaseAmount)
        : null,
      cardId: raw.cardId !== undefined ? (raw.cardId || null) : (sensitive.cardId || null),
      invoiceMonth: raw.invoiceMonth !== undefined ? (raw.invoiceMonth || null) : (sensitive.invoiceMonth || null),
      purchaseDate: raw.purchaseDate !== undefined ? (raw.purchaseDate || null) : (sensitive.purchaseDate || null),
      settledInvoiceKey: raw.settledInvoiceKey !== undefined ? (raw.settledInvoiceKey || null) : (sensitive.settledInvoiceKey || null),
    };
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt transaction ${raw.id}:`, err);
    return {
      id: raw.id,
      type: raw.type,
      status: raw.status || 'paid',
      date: raw.date,
      createdAt: raw.createdAt,
      amount: 0,
      description: '🔒 [Dado Cifrado]',
      categoryId: 'exp-other',
      notes: '',
    };
  }
}

export async function encryptCategory(
  cat: Category,
  masterKey: string,
  familyId: string
): Promise<{
  id: string;
  type: string;
  isDefault: number;
  iv: string;
  payload: string;
  encrypted_data: string;
}> {
  const sensitive = {
    name: cat.name,
    color: cat.color,
    icon: cat.icon,
  };
  const encrypted_data = await encryptPayload(sensitive, masterKey, familyId);
  const parts = encrypted_data.split(':');
  const iv = parts[1] || '';
  const payload = parts[2] || '';
  return {
    id: cat.id,
    type: cat.type,
    isDefault: cat.isDefault ? 1 : 0,
    iv,
    payload,
    encrypted_data,
  };
}

export async function decryptCategory(
  raw: any,
  masterKey: string,
  familyId: string
): Promise<Category> {
  const encData = raw.encrypted_data || (raw.iv && raw.payload ? `v1:${raw.iv}:${raw.payload}` : null);
  if (!encData) {
    return {
      id: raw.id,
      name: raw.name || '',
      type: raw.type,
      color: raw.color || '#6366f1',
      icon: raw.icon || 'Tag',
      isDefault: Number(raw.isDefault || 0),
    };
  }

  try {
    const sensitive = await decryptPayload<any>(encData, masterKey, familyId);
    return {
      id: raw.id,
      type: raw.type,
      isDefault: Number(raw.isDefault || 0),
      name: sensitive.name || '',
      color: sensitive.color || '#6366f1',
      icon: sensitive.icon || 'Tag',
    };
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt category ${raw.id}:`, err);
    return {
      id: raw.id,
      type: raw.type,
      isDefault: Number(raw.isDefault || 0),
      name: 'Categoria Cifrada',
      color: '#64748b',
      icon: 'Tag',
    };
  }
}

export async function encryptCreditCard(
  card: CreditCard,
  masterKey: string,
  familyId: string
): Promise<{
  id: string;
  createdAt: string;
  iv: string;
  payload: string;
  encrypted_data: string;
}> {
  const sensitive = {
    name: card.name,
    brand: card.brand,
    last4Digits: card.lastDigits || card.last4Digits || '',
    color: card.color,
    totalLimit: card.totalLimit,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
  };
  const encrypted_data = await encryptPayload(sensitive, masterKey, familyId);
  const parts = encrypted_data.split(':');
  const iv = parts[1] || '';
  const payload = parts[2] || '';
  return {
    id: card.id,
    createdAt: card.createdAt || new Date().toISOString(),
    iv,
    payload,
    encrypted_data,
  };
}

export async function decryptCreditCard(
  raw: any,
  masterKey: string,
  familyId: string
): Promise<CreditCard> {
  const encData = raw.encrypted_data || (raw.iv && raw.payload ? `v1:${raw.iv}:${raw.payload}` : null);
  if (!encData) {
    return {
      id: raw.id,
      name: raw.name || '',
      brand: raw.brand || 'other',
      lastDigits: raw.last4Digits || raw.lastDigits || '',
      color: raw.color || '#8b5cf6',
      totalLimit: Number(raw.totalLimit || 0),
      closingDay: Number(raw.closingDay || 25),
      dueDay: Number(raw.dueDay || 5),
      createdAt: raw.createdAt,
    };
  }

  try {
    const sensitive = await decryptPayload<any>(encData, masterKey, familyId);
    const digits = sensitive.last4Digits || sensitive.lastDigits || raw.last4Digits || raw.lastDigits || '';
    return {
      id: raw.id,
      createdAt: raw.createdAt,
      name: sensitive.name || 'Cartão',
      brand: sensitive.brand || raw.brand || 'other',
      lastDigits: digits,
      last4Digits: digits,
      color: sensitive.color || raw.color || '#8b5cf6',
      totalLimit: Number(sensitive.totalLimit ?? raw.totalLimit ?? 0),
      closingDay: Number(sensitive.closingDay ?? raw.closingDay ?? 25),
      dueDay: Number(sensitive.dueDay ?? raw.dueDay ?? 5),
    };
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt card ${raw.id}:`, err);
    return {
      id: raw.id,
      createdAt: raw.createdAt,
      name: '🔒 Cartão Cifrado',
      brand: 'other',
      lastDigits: '',
      color: '#64748b',
      totalLimit: 0,
      closingDay: 25,
      dueDay: 5,
    };
  }
}

export async function encryptFuelLog(
  fuel: FuelLog,
  masterKey: string,
  familyId: string
): Promise<{
  id: string;
  date: string;
  createdAt: string;
  transactionId?: string | null;
  iv: string;
  payload: string;
  encrypted_data: string;
}> {
  const sensitive = {
    odometer: fuel.odometer,
    pricePerLiter: fuel.pricePerLiter,
    totalCost: fuel.totalCost,
    liters: fuel.liters,
    fuelType: fuel.fuelType,
    stationName: fuel.stationName || '',
    isFullTank: fuel.isFullTank,
    transactionId: fuel.transactionId || null,
    notes: fuel.notes || '',
  };
  const encrypted_data = await encryptPayload(sensitive, masterKey, familyId);
  const parts = encrypted_data.split(':');
  const iv = parts[1] || '';
  const payload = parts[2] || '';
  return {
    id: fuel.id,
    date: fuel.date,
    createdAt: fuel.createdAt || new Date().toISOString(),
    transactionId: fuel.transactionId || null,
    iv,
    payload,
    encrypted_data,
  };
}

export async function decryptFuelLog(
  raw: any,
  masterKey: string,
  familyId: string
): Promise<FuelLog> {
  const encData = raw.encrypted_data || (raw.iv && raw.payload ? `v1:${raw.iv}:${raw.payload}` : null);
  if (!encData) {
    return {
      id: raw.id,
      date: raw.date,
      odometer: Number(raw.odometer || 0),
      pricePerLiter: Number(raw.pricePerLiter || 0),
      totalCost: Number(raw.totalCost || 0),
      liters: Number(raw.liters || 0),
      fuelType: raw.fuelType || 'gasoline',
      stationName: raw.stationName || '',
      isFullTank: Boolean(raw.isFullTank),
      transactionId: raw.transactionId || null,
      notes: raw.notes || '',
      createdAt: raw.createdAt,
    };
  }

  try {
    const sensitive = await decryptPayload<any>(encData, masterKey, familyId);
    return {
      id: raw.id,
      date: raw.date,
      createdAt: raw.createdAt,
      odometer: Number(sensitive.odometer || 0),
      pricePerLiter: Number(sensitive.pricePerLiter || 0),
      totalCost: Number(sensitive.totalCost || 0),
      liters: Number(sensitive.liters || 0),
      fuelType: sensitive.fuelType || 'gasoline',
      stationName: sensitive.stationName || '',
      isFullTank: Boolean(sensitive.isFullTank),
      transactionId: sensitive.transactionId || raw.transactionId || null,
      notes: sensitive.notes || '',
    };
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt fuel log ${raw.id}:`, err);
    return {
      id: raw.id,
      date: raw.date,
      createdAt: raw.createdAt,
      odometer: 0,
      pricePerLiter: 0,
      totalCost: 0,
      liters: 0,
      fuelType: 'gasoline',
      stationName: '',
      isFullTank: true,
      transactionId: null,
      notes: '',
    };
  }
}

export async function encryptRecurringTemplate(
  rec: RecurringTemplate,
  masterKey: string,
  familyId: string
): Promise<{
  id: string;
  type: string;
  active: boolean;
  createdAt: string;
  iv: string;
  payload: string;
  encrypted_data: string;
}> {
  const sensitive = {
    amount: rec.amount,
    description: rec.description,
    categoryId: rec.categoryId,
    dayOfMonth: rec.dayOfMonth,
    isInstallment: rec.isInstallment,
    totalInstallments: rec.totalInstallments || null,
    startMonth: rec.startMonth || null,
  };
  const encrypted_data = await encryptPayload(sensitive, masterKey, familyId);
  const parts = encrypted_data.split(':');
  const iv = parts[1] || '';
  const payload = parts[2] || '';
  return {
    id: rec.id,
    type: rec.type,
    active: rec.active,
    createdAt: rec.createdAt || new Date().toISOString(),
    iv,
    payload,
    encrypted_data,
  };
}

export async function decryptRecurringTemplate(
  raw: any,
  masterKey: string,
  familyId: string
): Promise<RecurringTemplate> {
  const encData = raw.encrypted_data || (raw.iv && raw.payload ? `v1:${raw.iv}:${raw.payload}` : null);
  if (!encData) {
    return {
      id: raw.id,
      type: raw.type,
      amount: Number(raw.amount || 0),
      description: raw.description || '',
      categoryId: raw.categoryId || '',
      dayOfMonth: Number(raw.dayOfMonth || 1),
      active: Boolean(raw.active),
      isInstallment: Boolean(raw.isInstallment),
      totalInstallments: raw.totalInstallments ? Number(raw.totalInstallments) : null,
      startMonth: raw.startMonth || null,
      createdAt: raw.createdAt,
    };
  }

  try {
    const sensitive = await decryptPayload<any>(encData, masterKey, familyId);
    return {
      id: raw.id,
      type: raw.type,
      active: Boolean(raw.active),
      createdAt: raw.createdAt,
      amount: Number(sensitive.amount || 0),
      description: sensitive.description || '',
      categoryId: sensitive.categoryId || '',
      dayOfMonth: Number(sensitive.dayOfMonth || 1),
      isInstallment: Boolean(sensitive.isInstallment),
      totalInstallments: sensitive.totalInstallments ? Number(sensitive.totalInstallments) : null,
      startMonth: sensitive.startMonth || null,
    };
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt recurring template ${raw.id}:`, err);
    return {
      id: raw.id,
      type: raw.type,
      active: Boolean(raw.active),
      createdAt: raw.createdAt,
      amount: 0,
      description: '🔒 [Recorrência Cifrada]',
      categoryId: 'exp-other',
      dayOfMonth: 1,
      isInstallment: false,
    };
  }
}

export class InvalidMasterKeyError extends Error {
  constructor(message = 'Chave Mestre de Segurança inválida para este espaço familiar. Verifique os 12 dígitos digitados.') {
    super(message);
    this.name = 'InvalidMasterKeyError';
  }
}

export async function decryptFullState(
  rawState: any,
  masterKey: string,
  familyId: string
): Promise<AppState> {
  // 1. Gather verified sample ciphertexts to test master key validity upfront
  const encryptedSamples: string[] = [];

  const isValidEncryptedString = (val: any): boolean => {
    if (typeof val !== 'string' || !val.startsWith('v1:')) return false;
    const parts = val.split(':');
    return parts.length === 3 && parts[1].length > 0 && parts[2].length > 0;
  };

  const addCandidate = (val: any) => {
    if (isValidEncryptedString(val) && !encryptedSamples.includes(val)) {
      encryptedSamples.push(val);
    }
  };

  if (rawState?.settings?.key_check) {
    addCandidate(rawState.settings.key_check);
  }
  if (rawState?.settings?.encrypted_settings) {
    addCandidate(rawState.settings.encrypted_settings);
  }
  for (const t of rawState?.transactions || []) {
    const enc = t.encrypted_data || (t.iv && t.payload ? `v1:${t.iv}:${t.payload}` : null);
    if (enc) {
      addCandidate(enc);
      if (encryptedSamples.length >= 3) break;
    }
  }
  if (encryptedSamples.length < 3) {
    for (const c of rawState?.categories || []) {
      const enc = c.encrypted_data || (c.iv && c.payload ? `v1:${c.iv}:${c.payload}` : null);
      if (enc) {
        addCandidate(enc);
        if (encryptedSamples.length >= 3) break;
      }
    }
  }
  if (encryptedSamples.length < 3) {
    for (const card of rawState?.creditCards || []) {
      const enc = card.encrypted_data || (card.iv && card.payload ? `v1:${card.iv}:${card.payload}` : null);
      if (enc) {
        addCandidate(enc);
        if (encryptedSamples.length >= 3) break;
      }
    }
  }
  if (encryptedSamples.length < 3) {
    for (const f of rawState?.fuelLogs || []) {
      const enc = f.encrypted_data || (f.iv && f.payload ? `v1:${f.iv}:${f.payload}` : null);
      if (enc) {
        addCandidate(enc);
        if (encryptedSamples.length >= 3) break;
      }
    }
  }
  if (encryptedSamples.length < 3) {
    for (const r of rawState?.recurringTemplates || []) {
      const enc = r.encrypted_data || (r.iv && r.payload ? `v1:${r.iv}:${r.payload}` : null);
      if (enc) {
        addCandidate(enc);
        if (encryptedSamples.length >= 3) break;
      }
    }
  }

  // If there are encrypted payloads, at least one sample MUST decrypt successfully
  if (encryptedSamples.length > 0) {
    let anySucceeded = false;
    for (const sample of encryptedSamples) {
      try {
        await decryptPayload(sample, masterKey, familyId);
        anySucceeded = true;
        break;
      } catch {
        // try next sample
      }
    }
    if (!anySucceeded) {
      console.error('[Crypto] Master key failed to decrypt sample ciphertexts. Master key is invalid.');
      throw new InvalidMasterKeyError();
    }
  }

  const [transactions, categories, creditCards, recurringTemplates, fuelLogs] = await Promise.all([
    Promise.all((rawState.transactions || []).map((t: any) => decryptTransaction(t, masterKey, familyId))),
    Promise.all((rawState.categories || []).map((c: any) => decryptCategory(c, masterKey, familyId))),
    Promise.all((rawState.creditCards || []).map((c: any) => decryptCreditCard(c, masterKey, familyId))),
    Promise.all((rawState.recurringTemplates || []).map((r: any) => decryptRecurringTemplate(r, masterKey, familyId))),
    Promise.all((rawState.fuelLogs || []).map((f: any) => decryptFuelLog(f, masterKey, familyId))),
  ]);

  let settings = rawState.settings;
  if (settings?.encrypted_settings) {
    try {
      const dec = await decryptPayload<any>(settings.encrypted_settings, masterKey, familyId);
      settings = { ...settings, ...dec };
    } catch (err) {
      console.error('[Crypto] Failed to decrypt settings:', err);
    }
  }

  return {
    settings,
    categories,
    transactions,
    creditCards,
    recurringTemplates,
    fuelLogs,
  };
}

import { AppState, FuelLog, RecurringTemplate } from '../../types';
import { decryptPayload, encryptPayload } from './cryptoPrimitives';
import {
  decryptCategory,
  decryptCreditCard,
  decryptTransaction,
} from './entityEncryption';
import { InvalidMasterKeyError } from './vaultCredentials';

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
  for (const col of [
    rawState?.transactions || [],
    rawState?.categories || [],
    rawState?.creditCards || [],
    rawState?.fuelLogs || [],
    rawState?.recurringTemplates || [],
  ]) {
    if (encryptedSamples.length >= 3) break;
    for (const item of col) {
      const enc = item.encrypted_data || (item.iv && item.payload ? `v1:${item.iv}:${item.payload}` : null);
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

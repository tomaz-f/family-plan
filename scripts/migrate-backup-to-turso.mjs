import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Read environment variables
function loadEnv() {
  const envPath = path.resolve(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const TURSO_URL = process.env.turso_db_url || process.env.TURSO_DB_URL;
const TURSO_TOKEN = process.env.turso_token || process.env.TURSO_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('[Error] turso_db_url or turso_token is missing from environment.');
  process.exit(1);
}

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

// 2. Constants for target family
const TARGET_FAMILY_ID = 'FP-6VJJJR';
const TARGET_MASTER_KEY = 'HL59-LVWS-VB3X';
const BACKUP_FILE = path.resolve(ROOT_DIR, 'familyplan-backup-2026-10-29.json');

// 3. Web Crypto API helpers (Exact match with client cryptoService.ts)
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function deriveAesKey(masterKey, familyId) {
  const cleanKey = masterKey.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(cleanKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = textEncoder.encode(`FP-SALT:${familyId.toUpperCase()}`);

  return globalThis.crypto.subtle.deriveKey(
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
}

async function encryptPayload(payload, aesKey) {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const jsonStr = JSON.stringify(payload);
  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    aesKey,
    textEncoder.encode(jsonStr)
  );

  const ivB64 = Buffer.from(iv).toString('base64');
  const cipherB64 = Buffer.from(new Uint8Array(cipherBuffer)).toString('base64');

  return {
    iv: ivB64,
    payload: cipherB64,
    encrypted_data: `v1:${ivB64}:${cipherB64}`,
  };
}

async function decryptPayload(serialized, aesKey) {
  if (!serialized || !serialized.startsWith('v1:')) {
    throw new Error('Formato cifrado inválido: ' + serialized);
  }
  const parts = serialized.split(':');
  const iv = Buffer.from(parts[1], 'base64');
  const cipherBytes = Buffer.from(parts[2], 'base64');

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    aesKey,
    new Uint8Array(cipherBytes)
  );

  return JSON.parse(textDecoder.decode(decryptedBuffer));
}

// Helper to chunk arrays for batch operations
function chunkArray(array, size = 50) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function runMigration() {
  console.log('=======================================================');
  console.log('  FAMILY PLAN - RESTORE & ZERO-KNOWLEDGE E2EE MIGRATION');
  console.log('=======================================================');
  console.log(`Target Family ID : ${TARGET_FAMILY_ID}`);
  console.log(`Master Key       : ${TARGET_MASTER_KEY}`);
  console.log(`Database URL     : ${TURSO_URL}`);
  console.log(`Backup File      : ${BACKUP_FILE}\n`);

  if (!fs.existsSync(BACKUP_FILE)) {
    throw new Error(`Arquivo de backup não encontrado em: ${BACKUP_FILE}`);
  }

  const rawJson = fs.readFileSync(BACKUP_FILE, 'utf8');
  const backup = JSON.parse(rawJson);

  console.log(`Backup Info:`);
  console.log(`- Exportado em      : ${backup.exportedAt}`);
  console.log(`- Transações        : ${backup.transactions?.length || 0}`);
  console.log(`- Abastecimentos    : ${backup.fuelLogs?.length || 0}`);
  console.log(`- Categorias        : ${backup.categories?.length || 0}`);
  console.log(`- Recorrências      : ${backup.recurringTemplates?.length || 0}\n`);

  console.log('1. Derivando Chave AES-256 via PBKDF2 (100.000 iterações)...');
  const aesKey = await deriveAesKey(TARGET_MASTER_KEY, TARGET_FAMILY_ID);
  console.log('   ✓ Chave criptográfica derivada com sucesso.');

  // 1. Limpar registros anteriores da família alvo se existirem (para importação limpa e idempotente)
  console.log('\n2. Limpando registros antigos da família FP-6VJJJR...');
  const cleanupStatements = [
    { sql: 'DELETE FROM transactions WHERE family_id = ?', args: [TARGET_FAMILY_ID] },
    { sql: 'DELETE FROM fuel_logs WHERE family_id = ?', args: [TARGET_FAMILY_ID] },
    { sql: 'DELETE FROM recurring_templates WHERE family_id = ?', args: [TARGET_FAMILY_ID] },
    { sql: 'DELETE FROM credit_cards WHERE family_id = ?', args: [TARGET_FAMILY_ID] },
    { sql: 'DELETE FROM categories WHERE family_id = ?', args: [TARGET_FAMILY_ID] },
    { sql: 'DELETE FROM settings WHERE family_id = ?', args: [TARGET_FAMILY_ID] },
    { sql: 'DELETE FROM families WHERE family_id = ?', args: [TARGET_FAMILY_ID] },
  ];
  await client.batch(cleanupStatements, 'write');
  console.log('   ✓ Espaço limpo e preparado para inserção.');

  // 2. Registrar Família
  console.log('\n3. Registrando espaço familiar...');
  const familyCreatedAt = backup.exportedAt || new Date().toISOString();
  await client.execute({
    sql: 'INSERT INTO families (family_id, created_at) VALUES (?, ?)',
    args: [TARGET_FAMILY_ID, familyCreatedAt],
  });
  console.log(`   ✓ Família ${TARGET_FAMILY_ID} registrada (created_at: ${familyCreatedAt}).`);

  // 3. Registrar Configurações
  console.log('\n4. Cifrando e gravando configurações familiares...');
  const settingsObj = {
    familyName: 'FAMILY PLAN',
    currency: backup.settings?.currency || 'BRL',
    language: backup.settings?.language || 'pt-BR',
    theme: backup.settings?.theme || 'oled',
    initialBalance: 319.54,
    tankCapacity: 54,
    updatedAt: new Date().toISOString(),
  };

  const encSettings = await encryptPayload(settingsObj, aesKey);

  const settingStatements = [
    {
      sql: 'INSERT INTO settings (family_id, key, value, iv, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      args: [TARGET_FAMILY_ID, 'familyName', 'FAMILY PLAN', null, null],
    },
    {
      sql: 'INSERT INTO settings (family_id, key, value, iv, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      args: [TARGET_FAMILY_ID, 'currency', 'BRL', null, null],
    },
    {
      sql: 'INSERT INTO settings (family_id, key, value, iv, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      args: [TARGET_FAMILY_ID, 'language', 'pt-BR', null, null],
    },
    {
      sql: 'INSERT INTO settings (family_id, key, value, iv, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      args: [TARGET_FAMILY_ID, 'theme', 'oled', null, null],
    },
    {
      sql: 'INSERT INTO settings (family_id, key, value, iv, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      args: [TARGET_FAMILY_ID, 'initialBalance', '319.54', null, null],
    },
    {
      sql: 'INSERT INTO settings (family_id, key, value, iv, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      args: [TARGET_FAMILY_ID, 'tankCapacity', '54', null, null],
    },
    {
      sql: 'INSERT INTO settings (family_id, key, value, iv, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      args: [TARGET_FAMILY_ID, 'updatedAt', new Date().toISOString(), null, null],
    },
    {
      sql: 'INSERT INTO settings (family_id, key, value, iv, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      args: [TARGET_FAMILY_ID, 'encrypted_settings', '1', encSettings.iv, encSettings.encrypted_data],
    },
  ];
  await client.batch(settingStatements, 'write');
  console.log(`   ✓ Configurações salvas: initialBalance=319.54, tankCapacity=54, theme=oled.`);

  // 4. Cifrar e Gravar Categorias
  console.log('\n5. Cifrando e gravando 32 categorias...');
  const categoryStatements = [];
  for (const cat of (backup.categories || [])) {
    const sensitive = {
      name: cat.name,
      color: cat.color || '#6366f1',
      icon: cat.icon || 'Tag',
    };
    const enc = await encryptPayload(sensitive, aesKey);

    categoryStatements.push({
      sql: `INSERT INTO categories
        (family_id, id, name, type, color, icon, isDefault, iv, encrypted_data, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        TARGET_FAMILY_ID,
        cat.id,
        null, // Zero-knowledge: cleartext column is NULL
        cat.type === 'income' ? 'income' : 'expense',
        cat.color || '#6366f1',
        cat.icon || 'Tag',
        cat.isDefault ? 1 : 0,
        enc.iv,
        enc.encrypted_data,
        enc.payload,
      ],
    });
  }

  for (const chunk of chunkArray(categoryStatements, 50)) {
    await client.batch(chunk, 'write');
  }
  console.log(`   ✓ ${categoryStatements.length} categorias cifradas e salvas com sucesso.`);

  // 5. Cifrar e Gravar Transações
  console.log(`\n6. Cifrando e gravando ${backup.transactions.length} transações financeiras...`);
  const txStatements = [];
  for (const tx of (backup.transactions || [])) {
    const sensitive = {
      amount: Number(tx.amount || 0),
      description: String(tx.description || '').trim(),
      categoryId: String(tx.categoryId || ''),
      notes: String(tx.notes || '').trim(),
      status: tx.status === 'unpaid' ? 'unpaid' : 'paid',
      dueDay: tx.dueDay ? Number(tx.dueDay) : null,
      installmentCurrent: tx.installmentCurrent ? Number(tx.installmentCurrent) : null,
      installmentTotal: tx.installmentTotal ? Number(tx.installmentTotal) : null,
      recurringId: tx.recurringId || null,
      cardId: tx.cardId || null,
      invoiceMonth: tx.invoiceMonth || null,
      purchaseDate: tx.purchaseDate || null,
      settledInvoiceKey: tx.settledInvoiceKey || null,
    };

    const enc = await encryptPayload(sensitive, aesKey);

    txStatements.push({
      sql: `INSERT INTO transactions
        (family_id, id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt, iv, encrypted_data, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        TARGET_FAMILY_ID,
        tx.id,
        tx.type === 'income' ? 'income' : 'expense',
        tx.status === 'unpaid' ? 'unpaid' : 'paid',
        null, // Zero-knowledge: cleartext amount is NULL
        null, // Zero-knowledge: cleartext description is NULL
        null, // Zero-knowledge: cleartext categoryId is NULL
        String(tx.date),
        null, // Zero-knowledge: cleartext notes is NULL
        tx.recurringId || null,
        tx.dueDay ? Number(tx.dueDay) : null,
        tx.installmentCurrent ? Number(tx.installmentCurrent) : null,
        tx.installmentTotal ? Number(tx.installmentTotal) : null,
        tx.cardId || null,
        tx.invoiceMonth || null,
        tx.purchaseDate || null,
        tx.settledInvoiceKey || null,
        tx.createdAt || new Date().toISOString(),
        enc.iv,
        enc.encrypted_data,
        enc.payload,
      ],
    });
  }

  for (const chunk of chunkArray(txStatements, 50)) {
    await client.batch(chunk, 'write');
  }
  console.log(`   ✓ ${txStatements.length} transações cifradas e gravadas com sucesso.`);

  // 6. Cifrar e Gravar Abastecimentos (fuelLogs)
  console.log(`\n7. Cifrando e gravando ${backup.fuelLogs.length} registros de combustível...`);
  const fuelStatements = [];
  for (const fuel of (backup.fuelLogs || [])) {
    const txId = fuel.transactionId || `tx-fuel-${fuel.id}`;
    const sensitive = {
      odometer: Number(fuel.odometer || 0),
      pricePerLiter: Number(fuel.pricePerLiter || 0),
      totalCost: Number(fuel.totalCost || 0),
      liters: Number(fuel.liters || 0),
      fuelType: fuel.fuelType || 'gasoline',
      stationName: String(fuel.stationName || ''),
      isFullTank: Boolean(fuel.isFullTank),
      transactionId: txId,
      notes: String(fuel.notes || ''),
    };

    const enc = await encryptPayload(sensitive, aesKey);

    fuelStatements.push({
      sql: `INSERT INTO fuel_logs
        (family_id, id, date, odometer, pricePerLiter, totalCost, liters, fuelType, stationName, isFullTank, transactionId, notes, createdAt, iv, encrypted_data, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        TARGET_FAMILY_ID,
        fuel.id,
        String(fuel.date),
        null, // Zero-knowledge: odometer is NULL
        null, // Zero-knowledge: pricePerLiter is NULL
        null, // Zero-knowledge: totalCost is NULL
        null, // Zero-knowledge: liters is NULL
        fuel.fuelType || 'gasoline',
        null, // Zero-knowledge: stationName is NULL
        fuel.isFullTank ? 1 : 0,
        txId,
        null, // Zero-knowledge: notes is NULL
        fuel.createdAt || new Date().toISOString(),
        enc.iv,
        enc.encrypted_data,
        enc.payload,
      ],
    });
  }

  await client.batch(fuelStatements, 'write');
  console.log(`   ✓ ${fuelStatements.length} abastecimentos cifrados e vinculados às transações financeiras.`);

  // 7. Cifrar e Gravar Recorrências (recurringTemplates)
  console.log(`\n8. Cifrando e gravando ${backup.recurringTemplates.length} modelos de recorrência...`);
  const recStatements = [];
  for (const rec of (backup.recurringTemplates || [])) {
    const sensitive = {
      amount: Number(rec.amount || 0),
      description: String(rec.description || '').trim(),
      categoryId: String(rec.categoryId || ''),
      dayOfMonth: Number(rec.dayOfMonth || 1),
      isInstallment: Boolean(rec.isInstallment),
      totalInstallments: rec.totalInstallments ? Number(rec.totalInstallments) : null,
      startMonth: rec.startMonth || null,
    };

    const enc = await encryptPayload(sensitive, aesKey);

    recStatements.push({
      sql: `INSERT INTO recurring_templates
        (family_id, id, type, amount, description, categoryId, dayOfMonth, active, isInstallment, totalInstallments, startMonth, createdAt, iv, encrypted_data, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        TARGET_FAMILY_ID,
        rec.id,
        rec.type || 'expense',
        null, // Zero-knowledge: amount is NULL
        null, // Zero-knowledge: description is NULL
        null, // Zero-knowledge: categoryId is NULL
        Number(rec.dayOfMonth || 1),
        rec.active ? 1 : 0,
        rec.isInstallment ? 1 : 0,
        rec.totalInstallments ? Number(rec.totalInstallments) : null,
        rec.startMonth || null,
        rec.createdAt || new Date().toISOString(),
        enc.iv,
        enc.encrypted_data,
        enc.payload,
      ],
    });
  }

  await client.batch(recStatements, 'write');
  console.log(`   ✓ ${recStatements.length} recorrências cifradas e salvas com sucesso.`);

  // 8. VERIFICAÇÃO INTEGRAL VIA DECRIPTAÇÃO EM TEMPO REAL
  console.log('\n=======================================================');
  console.log('  VERIFICAÇÃO DE INTEGRIDADE (DECRIPTAÇÃO TESTE)');
  console.log('=======================================================');

  // Transações
  const txQuery = await client.execute({
    sql: 'SELECT id, type, date, amount, description, iv, payload, encrypted_data FROM transactions WHERE family_id = ? ORDER BY date DESC',
    args: [TARGET_FAMILY_ID],
  });
  console.log(`- Transações gravadas no Turso : ${txQuery.rows.length}`);
  
  // Amostra física do banco
  const sampleRaw = txQuery.rows[0];
  console.log(`- Amostra física (sem chave)  :`);
  console.log(`  ID: ${sampleRaw.id}`);
  console.log(`  amount: ${sampleRaw.amount} (Tipo: ${sampleRaw.amount})`);
  console.log(`  description: ${sampleRaw.description} (Tipo: ${sampleRaw.description})`);
  console.log(`  iv: ${sampleRaw.iv}`);
  console.log(`  encrypted_data: ${sampleRaw.encrypted_data?.slice(0, 30)}...`);

  // Testar decriptação de todas as transações
  let totalIncome = 0;
  let totalExpense = 0;
  let paidIncome = 0;
  let paidExpense = 0;

  for (const row of txQuery.rows) {
    const dec = await decryptPayload(row.encrypted_data, aesKey);
    if (typeof dec.amount !== 'number' || !dec.description) {
      throw new Error(`Falha de integridade ao decifrar transação ${row.id}`);
    }
    if (row.type === 'income') {
      totalIncome += dec.amount;
      if (dec.status === 'paid') paidIncome += dec.amount;
    } else {
      totalExpense += dec.amount;
      if (dec.status === 'paid') paidExpense += dec.amount;
    }
  }

  console.log(`\n✓ TODAS AS ${txQuery.rows.length} TRANSAÇÕES DECIFRADAS COM SUCESSO!`);
  console.log(`- Receitas Totais : R$ ${totalIncome.toFixed(2)} (Pagas: R$ ${paidIncome.toFixed(2)})`);
  console.log(`- Despesas Totais : R$ ${totalExpense.toFixed(2)} (Pagas: R$ ${paidExpense.toFixed(2)})`);
  const calculatedBankBalance = 319.54 + paidIncome - paidExpense;
  console.log(`- Saldo em Conta Calculado : R$ ${calculatedBankBalance.toFixed(2)}`);

  // Abastecimentos
  const fuelQuery = await client.execute({
    sql: 'SELECT id, date, odometer, totalCost, encrypted_data FROM fuel_logs WHERE family_id = ? ORDER BY date DESC',
    args: [TARGET_FAMILY_ID],
  });
  console.log(`\n- Abastecimentos gravados no Turso: ${fuelQuery.rows.length}`);
  for (const f of fuelQuery.rows) {
    const decFuel = await decryptPayload(f.encrypted_data, aesKey);
    console.log(`  • ${f.date} | ${decFuel.stationName} | R$ ${decFuel.totalCost.toFixed(2)} (${decFuel.liters}L ${decFuel.fuelType}) [Odôm: ${decFuel.odometer} km]`);
  }

  // Categorias
  const catQuery = await client.execute({
    sql: 'SELECT id, type, encrypted_data FROM categories WHERE family_id = ? ORDER BY type, id',
    args: [TARGET_FAMILY_ID],
  });
  console.log(`\n- Categorias gravadas no Turso: ${catQuery.rows.length}`);
  const catNames = [];
  for (const c of catQuery.rows) {
    const decCat = await decryptPayload(c.encrypted_data, aesKey);
    catNames.push(decCat.name);
  }
  console.log(`  • Categorias decifradas: ${catNames.slice(0, 8).join(', ')}... (+${catNames.length - 8} categorias)`);

  // Recorrências
  const recQuery = await client.execute({
    sql: 'SELECT id, type, encrypted_data FROM recurring_templates WHERE family_id = ?',
    args: [TARGET_FAMILY_ID],
  });
  console.log(`\n- Recorrências gravadas no Turso: ${recQuery.rows.length}`);
  for (const r of recQuery.rows.slice(0, 5)) {
    const decRec = await decryptPayload(r.encrypted_data, aesKey);
    console.log(`  • Dia ${decRec.dayOfMonth}: ${decRec.description} - R$ ${decRec.amount.toFixed(2)}`);
  }

  console.log('\n=======================================================');
  console.log('🎉 MIGRAÇÃO CONCLUÍDA COM 100% DE SUCESSO NO TURSO!');
  console.log('=======================================================');
  console.log('\nPara entrar diretamente no app:');
  console.log(`- Código Familiar (Pairing Code) : ${TARGET_FAMILY_ID}`);
  console.log(`- Chave Mestre (Security Key)    : ${TARGET_MASTER_KEY}`);
  console.log(`- URL direta com pareamento auto : ?code=${TARGET_FAMILY_ID}&key=${TARGET_MASTER_KEY}`);
  console.log('\nNo console do navegador (DevTools / F12):');
  console.log(`localStorage.setItem('familyplan_family_id', '${TARGET_FAMILY_ID}');`);
  console.log(`localStorage.setItem('familyplan_master_key', '${TARGET_MASTER_KEY}');`);
  console.log('location.reload();\n');
}

runMigration().catch((err) => {
  console.error('\n❌ Erro durante a migração:', err);
  process.exit(1);
});

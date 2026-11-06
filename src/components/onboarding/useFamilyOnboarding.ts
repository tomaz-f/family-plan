import React, { useState, useEffect } from 'react';
import {
  createFamily,
  joinFamily,
  sanitizeFamilyCode,
  generateMasterKey,
  sanitizeMasterKey,
  setStoredMasterKey,
  setStoredFamilyId,
  getStoredFamilyId,
  decryptPayload,
  encryptPayload,
  decryptFullState,
  apiFetch,
} from '../../services/tursoService';

export const SUBTITLE_TEXT =
  'Gestão financeira familiar com foco em simplicidade e privacidade absoluta';

export type OnboardingMode = 'initial' | 'join' | 'created';

export interface UseFamilyOnboardingParams {
  onJoined: (familyId: string, masterKey: string) => void;
  initialError?: string | null;
  initialFamilyId?: string | null;
}

export function useFamilyOnboarding({
  onJoined,
  initialError,
  initialFamilyId,
}: UseFamilyOnboardingParams) {
  const [mode, setMode] = useState<OnboardingMode>(() =>
    initialError || initialFamilyId ? 'join' : 'initial'
  );
  const [inputCode, setInputCode] = useState(() =>
    initialFamilyId || (initialError ? getStoredFamilyId() || '' : '')
  );
  const [inputKey, setInputKey] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (initialFamilyId) {
      setInputCode(initialFamilyId);
      setMode('join');
    }
  }, [initialFamilyId]);

  useEffect(() => {
    if (initialError) {
      setErrorMessage(initialError);
    }
  }, [initialError]);

  // Two-way continuous looping typewriter effect for subtitle
  const [displayedSubtitle, setDisplayedSubtitle] = useState('');

  useEffect(() => {
    let index = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const step = () => {
      if (!isDeleting) {
        index++;
        setDisplayedSubtitle(SUBTITLE_TEXT.slice(0, index));
        if (index >= SUBTITLE_TEXT.length) {
          isDeleting = true;
          timeoutId = setTimeout(step, 2500); // Pause 2.5s when full sentence is visible
        } else {
          timeoutId = setTimeout(step, 32); // Smooth steady typing cadence
        }
      } else {
        index--;
        setDisplayedSubtitle(SUBTITLE_TEXT.slice(0, index));
        if (index <= 0) {
          isDeleting = false;
          timeoutId = setTimeout(step, 500); // Brief 500ms pause before repeating
        } else {
          timeoutId = setTimeout(step, 18); // Smooth backspacing cadence
        }
      }
    };

    timeoutId = setTimeout(step, 250);
    return () => clearTimeout(timeoutId);
  }, []);

  // Flow 1: Create a brand new family space + generate local Zero-Knowledge Master Key
  const handleCreateNewFamily = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const generatedMasterKey = generateMasterKey();
      const result = await createFamily();

      // Store Master Key ONLY on this device (Zero-Knowledge)
      setStoredMasterKey(generatedMasterKey);
      setStoredFamilyId(result.familyId);

      // Initialize key_check canary on server for Zero-Knowledge validation
      try {
        const canaryEncrypted = await encryptPayload(
          { canary: 'PRUMO_E2EE_VERIFIED', createdAt: new Date().toISOString() },
          generatedMasterKey,
          result.familyId
        );
        await apiFetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Family-Id': result.familyId },
          body: JSON.stringify({ keyCheck: canaryEncrypted }),
        });
      } catch {
        // non-blocking
      }

      setCreatedCode(result.familyId);
      setCreatedKey(generatedMasterKey);
      setMode('created');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao criar novo espaço familiar. Tente novamente.';
      setErrorMessage(message || 'Erro ao criar novo espaço familiar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Flow 2: Join an existing family with Pairing Code + Master Key
  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = sanitizeFamilyCode(inputCode);
    const cleanKey = sanitizeMasterKey(inputKey);

    if (!cleanCode) {
      setErrorMessage('Digite o código de pareamento no formato FP-XXXXXX.');
      return;
    }

    if (cleanKey.length !== 14) {
      setErrorMessage('Digite a chave mestre de 12 dígitos (ex: 9X4K-7M2P-W3N8).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await joinFamily(cleanCode);
      if (!result.valid || !result.familyId) {
        setErrorMessage(
          result.error || 'Código de pareamento não encontrado. Verifique os dados digitados.'
        );
        return;
      }

      // 1. Immediate canary verification
      if (result.sampleEncrypted) {
        try {
          await decryptPayload(result.sampleEncrypted, cleanKey, result.familyId);
        } catch {
          setErrorMessage(
            'Chave Mestre de Segurança inválida para este espaço familiar. Verifique os 12 dígitos digitados.'
          );
          return;
        }
      }

      // 2. Comprehensive state verification: verify against full state
      try {
        const stateRes = await apiFetch('/api/state', {
          headers: { 'X-Family-Id': result.familyId },
        });
        if (stateRes.ok) {
          const rawState = await stateRes.json();
          await decryptFullState(rawState, cleanKey, result.familyId);
        }
      } catch {
        setErrorMessage(
          'Chave Mestre de Segurança inválida para este espaço familiar. Verifique os 12 dígitos digitados.'
        );
        return;
      }

      // Master Key is cryptographically verified! Save credentials to device storage
      setStoredMasterKey(cleanKey);
      setStoredFamilyId(result.familyId);

      // Save a key_check canary on server if not present yet
      try {
        const canaryEncrypted = await encryptPayload(
          { canary: 'PRUMO_E2EE_VERIFIED', verifiedAt: new Date().toISOString() },
          cleanKey,
          result.familyId
        );
        await apiFetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Family-Id': result.familyId },
          body: JSON.stringify({ keyCheck: canaryEncrypted }),
        });
      } catch {
        // non-blocking
      }

      onJoined(result.familyId, cleanKey);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao conectar. Verifique sua conexão e tente novamente.';
      setErrorMessage(message || 'Erro ao conectar. Verifique sua conexão e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, type: 'code' | 'key') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  return {
    mode,
    setMode,
    inputCode,
    setInputCode,
    inputKey,
    setInputKey,
    createdCode,
    createdKey,
    isLoading,
    errorMessage,
    setErrorMessage,
    copiedCode,
    copiedKey,
    displayedSubtitle,
    handleCreateNewFamily,
    handleJoinFamily,
    handleCopy,
  };
}

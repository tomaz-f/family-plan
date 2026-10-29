import React, { useState, useEffect } from 'react';
import { ShieldCheck, KeyRound, Plus, ArrowRight, Copy, Check, AlertCircle, Loader2, Lock, Shield } from 'lucide-react';
import {
  createFamily,
  joinFamily,
  sanitizeFamilyCode,
  generateMasterKey,
  sanitizeMasterKey,
  setStoredMasterKey,
  setStoredFamilyId,
} from '../services/tursoService';

interface FamilyOnboardingScreenProps {
  onJoined: (familyId: string, masterKey: string) => void;
}

const SUBTITLE_TEXT = 'Gestão financeira familiar com foco em simplicidade e privacidade absoluta.';

export const FamilyOnboardingScreen: React.FC<FamilyOnboardingScreenProps> = ({ onJoined }) => {
  const [mode, setMode] = useState<'initial' | 'join' | 'created'>('initial');
  const [inputCode, setInputCode] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Typewriter effect for subtitle
  const [displayedSubtitle, setDisplayedSubtitle] = useState('');
  const [typewriterDone, setTypewriterDone] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayedSubtitle('');
    setTypewriterDone(false);
    const timer = setInterval(() => {
      i++;
      setDisplayedSubtitle(SUBTITLE_TEXT.slice(0, i));
      if (i >= SUBTITLE_TEXT.length) {
        clearInterval(timer);
        setTypewriterDone(true);
      }
    }, 28);
    return () => clearInterval(timer);
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

      setCreatedCode(result.familyId);
      setCreatedKey(generatedMasterKey);
      setMode('created');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao criar novo espaço familiar. Tente novamente.');
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
      if (result.valid && result.familyId) {
        setStoredMasterKey(cleanKey);
        setStoredFamilyId(result.familyId);
        onJoined(result.familyId, cleanKey);
      } else {
        setErrorMessage(result.error || 'Código de pareamento não encontrado. Verifique os dados digitados.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao conectar. Verifique sua conexão e tente novamente.');
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

  return (
    <div className="min-h-screen w-full bg-[#000000] text-white flex flex-col items-center justify-center p-6 selection:bg-neutral-800 selection:text-white">
      {/* Brand Header */}
      <div className="w-full max-w-sm flex flex-col items-center text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[#111215] border border-[#22242a] flex items-center justify-center mb-4 shadow-sm">
          <ShieldCheck className="w-6 h-6 text-zinc-200" strokeWidth={1.8} />
        </div>

        {/* App Title: FAMILY PLAN (all-caps, refined tracking, premium typography) */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-[0.25em] text-white uppercase font-sans">
          FAMILY PLAN
        </h1>

        {/* Subtitle with Typewriter effect */}
        <div className="min-h-[42px] flex items-center justify-center mt-2 px-2">
          <p className="text-xs text-[#8E929B] leading-relaxed max-w-[280px]">
            {displayedSubtitle}
            {!typewriterDone && (
              <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-sm">
        {mode === 'initial' && (
          <div className="space-y-3.5 animate-fadeIn">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 flex items-start gap-2.5 text-xs text-red-300 mb-3 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* High-Contrast Main Button: "+ Novo Espaço Familiar" */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleCreateNewFamily}
              className="w-full py-4 px-5 rounded-xl font-medium text-base bg-[#242832] hover:bg-[#2e3340] active:bg-[#1a1d24] text-white border border-[#3f4556] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-black/40 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-100" />
                  <span className="text-zinc-100">Criando chave segura...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-zinc-100" strokeWidth={2.5} />
                  <span className="text-zinc-100 font-semibold tracking-wide">+ Novo Espaço Familiar</span>
                </>
              )}
            </button>

            {/* Secondary Button: "Ingressar com código" */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setMode('join');
                setErrorMessage(null);
                setInputCode('');
                setInputKey('');
              }}
              className="w-full py-3.5 px-4 rounded-xl font-medium text-sm bg-[#111215] border border-[#22242a] text-[#D1D5DB] hover:bg-[#181a20] hover:text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-[#8E929B]" strokeWidth={2} />
              <span>Ingressar com código</span>
            </button>

            {/* Footer Support Text */}
            <div className="pt-4 flex items-center justify-center gap-2 text-center text-[#606470]">
              <Lock className="w-3 h-3 shrink-0 text-emerald-500/70" />
              <p className="text-[11px] leading-tight">
                Sincronização multi-dispositivos com criptografia de ponta a ponta para privacidade total da sua família.
              </p>
            </div>
          </div>
        )}

        {/* Mode: Join with Pairing Code + Master Key */}
        {mode === 'join' && (
          <form onSubmit={handleJoinFamily} className="space-y-3.5 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-[#111215] border border-[#22242a] space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E929B] mb-1.5">
                  1. Código de Pareamento
                </label>
                <input
                  type="text"
                  autoFocus
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    setErrorMessage(null);
                  }}
                  placeholder="Ex: FP-849201"
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[#0a0a0c] border border-[#2a2c34] text-white font-mono text-sm tracking-wider uppercase placeholder:tracking-normal placeholder:normal-case placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E929B] mb-1.5">
                  2. Chave Mestre de Segurança
                </label>
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => {
                    setInputKey(sanitizeMasterKey(e.target.value));
                    setErrorMessage(null);
                  }}
                  placeholder="Ex: 9X4K-7M2P-W3N8"
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[#0a0a0c] border border-[#2a2c34] text-white font-mono text-sm tracking-wider uppercase placeholder:tracking-normal placeholder:normal-case placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 transition-colors"
                />
                <p className="text-[10px] text-[#606470] mt-1">
                  Chave AES-256 de 12 caracteres dividida em 3 blocos.
                </p>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 animate-fadeIn pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={isLoading || !inputCode.trim() || inputKey.length < 14}
                className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-[#242832] hover:bg-[#2e3340] text-white border border-[#3f4556] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-100" />
                    <span className="text-zinc-100">Decifrando e entrando...</span>
                  </>
                ) : (
                  <>
                    <span className="text-zinc-100">Entrar na Família</span>
                    <ArrowRight className="w-4 h-4 text-zinc-100" />
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setMode('initial');
                  setErrorMessage(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-[#8E929B] hover:text-white transition-colors text-center"
              >
                Voltar
              </button>
            </div>
          </form>
        )}

        {/* Mode: Family Created Success Screen with Master Key Guard */}
        {mode === 'created' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-5 rounded-2xl bg-[#111215] border border-[#22242a] space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Espaço Familiar Criado</h3>
                  <p className="text-[11px] text-[#8E929B]">
                    Criptografia de Ponta a Ponta (AES-256) ativada.
                  </p>
                </div>
              </div>

              {/* Pairing Code */}
              <div className="p-3 rounded-xl bg-[#0a0a0c] border border-[#22242a] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[#8E929B] uppercase tracking-wider">
                    Código de Pareamento
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdCode, 'code')}
                    className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white p-1 rounded"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="font-mono text-base font-bold tracking-wider text-white">
                  {createdCode}
                </div>
              </div>

              {/* Master Key Card */}
              <div className="p-3 rounded-xl bg-[#0a0a0c] border border-amber-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Chave Mestre de Segurança
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdKey, 'key')}
                    className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-white p-1 rounded"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="font-mono text-base font-bold tracking-widest text-amber-200">
                  {createdKey}
                </div>
              </div>

              {/* Warning Notice */}
              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-200/90 leading-relaxed">
                ⚠️ <strong>Guarde esta chave em segurança.</strong> Ela é a única forma de decifrar e sincronizar seus dados em outro aparelho. O servidor não guarda cópia da sua chave mestre.
              </div>
            </div>

            {/* Mandatory "Já guardei a chave" confirmation button */}
            <button
              type="button"
              onClick={() => onJoined(createdCode, createdKey)}
              className="w-full py-4 px-4 rounded-xl font-semibold text-base bg-[#242832] hover:bg-[#2e3340] text-white border border-[#3f4556] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/40"
            >
              <span className="text-zinc-100">Já guardei a chave</span>
              <ArrowRight className="w-4 h-4 text-zinc-100" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

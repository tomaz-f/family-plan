import React, { useState, useEffect } from 'react';
import { KeyRound, ArrowRight, Copy, Check, AlertCircle, Loader2, Lock, Shield } from 'lucide-react';
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

const SUBTITLE_TEXT = 'Gestão financeira familiar com foco em simplicidade e privacidade absoluta';

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
    <div className="min-h-[100dvh] w-full bg-[#000000] text-white flex flex-col items-center justify-between px-6 pt-0 pb-[max(2.25rem,env(safe-area-inset-bottom,0px))] selection:bg-neutral-800 selection:text-white">
      {/* Top Section: Hanging Animated Plumb Bob (Prumo) + Brand Header + Subtitle */}
      <div className="w-full max-w-sm flex flex-col items-center text-center shrink-0">
        {/* Animated Plumb Bob SVG hanging directly from the top edge of the viewport */}
        <div className="w-44 h-44 sm:w-52 sm:h-52 -mt-1 flex items-start justify-center pointer-events-none select-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className="w-full h-full block"
            aria-label="Prumo"
          >
            <defs>
              <linearGradient id="ironLightPrumo" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6E5440" />
                <stop offset="40%" stopColor="#8A6F57" />
                <stop offset="85%" stopColor="#543E2C" />
                <stop offset="100%" stopColor="#3D2B1E" />
              </linearGradient>

              <linearGradient id="ironDarkPrumo" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3A2719" />
                <stop offset="40%" stopColor="#24170E" />
                <stop offset="90%" stopColor="#120B06" />
                <stop offset="100%" stopColor="#050302" />
              </linearGradient>

              <linearGradient id="ropePrumo" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D0B595" />
                <stop offset="50%" stopColor="#E7CDAC" />
                <stop offset="100%" stopColor="#A68969" />
              </linearGradient>

              <style>{`
                .prumo-calm-hero {
                  animation: calmWaveHero 4.2s ease-in-out infinite;
                }
                @keyframes calmWaveHero {
                  0%, 100% { transform: translateY(-12px); }
                  50% { transform: translateY(12px); }
                }
              `}</style>
            </defs>

            <rect width="512" height="512" fill="#000000" />

            <g className="prumo-calm-hero">
              {/* Corda natural */}
              <line
                x1="256"
                y1="-80"
                x2="256"
                y2="190"
                stroke="url(#ropePrumo)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <line x1="252" y1="30" x2="260" y2="34" stroke="#846B4E" strokeWidth="2" />
              <line x1="252" y1="70" x2="260" y2="74" stroke="#846B4E" strokeWidth="2" />
              <line x1="252" y1="110" x2="260" y2="114" stroke="#846B4E" strokeWidth="2" />
              <line x1="252" y1="150" x2="260" y2="154" stroke="#846B4E" strokeWidth="2" />

              {/* Nó Rústico Amarrado */}
              <ellipse cx="256" cy="188" rx="14" ry="11" fill="#8C7051" />
              <path d="M 246 182 C 248 195 264 195 266 182 Z" fill="#D0B595" />
              <circle cx="254" cy="188" r="4.5" fill="#5E4730" />

              {/* Furo/Argola de ferro (olhal circular no topo) */}
              <circle cx="256" cy="226" r="28" fill="none" stroke="url(#ironLightPrumo)" strokeWidth="15" />
              <circle
                cx="256"
                cy="226"
                r="28"
                fill="none"
                stroke="url(#ironDarkPrumo)"
                strokeDasharray="0, 88"
                strokeWidth="15"
              />

              {/* Base do Olhal / Gargalo Ranhurado */}
              <ellipse cx="256" cy="254" rx="19" ry="6" fill="url(#ironLightPrumo)" />
              <ellipse cx="256" cy="260" rx="15" ry="4" fill="url(#ironDarkPrumo)" />

              {/* Ombros cônicos superiores */}
              <path d="M 256 260 L 180 300 L 256 300 Z" fill="url(#ironLightPrumo)" />
              <path d="M 256 260 L 256 300 L 332 300 Z" fill="url(#ironDarkPrumo)" />

              {/* Corpo Cônico Principal Inferior */}
              <path d="M 180 300 L 256 466 L 256 300 Z" fill="url(#ironLightPrumo)" />
              <path d="M 256 300 L 256 466 L 332 300 Z" fill="url(#ironDarkPrumo)" />

              <circle cx="256" cy="466" r="2" fill="#FFFFFF" opacity="0.8" />
            </g>
          </svg>
        </div>

        {/* Brand Name + Subtitle Block aligned to the same visual width */}
        <div className="w-[264px] sm:w-[284px] mx-auto mt-3 flex flex-col items-center">
          {/* Enlarged PRUMO title spanning the exact width of the subtitle container immediately below */}
          <h1
            aria-label="PRUMO"
            className="w-full flex items-center justify-between text-[2.5rem] sm:text-[2.75rem] font-extrabold uppercase font-sans text-[#E5E7EB] leading-none whitespace-nowrap select-none"
          >
            <span>P</span>
            <span>R</span>
            <span>U</span>
            <span>M</span>
            <span>O</span>
          </h1>

          {/* Subtitle immediately below PRUMO with fixed min-height to prevent layout shifts (CLS) */}
          <div className="w-full min-h-[44px] sm:min-h-[48px] flex items-start justify-center mt-2.5">
            <p className="text-xs sm:text-[13px] text-[#8E929B] leading-relaxed text-center">
              {displayedSubtitle}
              <span className="inline-block w-1.5 h-3.5 bg-[#D0B595]/80 ml-0.5 animate-pulse align-middle" />
            </p>
          </div>
        </div>
      </div>

      {/* Lower Section: Action Buttons & Security Note */}
      <div className="w-full max-w-sm mt-auto pt-10">
        {mode === 'initial' && (
          <div className="space-y-3.5 animate-fadeIn">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 flex items-start gap-2.5 text-xs text-red-300 mb-3 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Primary Button: "Novo Espaço Familiar" styled in warm oxidized iron / rustic bronze */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleCreateNewFamily}
              className="w-full py-4 px-5 rounded-xl font-semibold text-sm sm:text-base bg-[#6E5440] hover:bg-[#7E624B] active:bg-[#5A4535] text-[#FFFDF5] border border-[#8A6F57]/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-black/50 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#FFFDF5]" />
                  <span className="text-[#FFFDF5]">Criando chave segura...</span>
                </>
              ) : (
                <span className="text-[#FFFDF5] font-semibold tracking-wide">Novo Espaço Familiar</span>
              )}
            </button>

            {/* Secondary Button: "Ingressar com código" with consistent padding, typography, and alignment */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setMode('join');
                setErrorMessage(null);
                setInputCode('');
                setInputKey('');
              }}
              className="w-full py-4 px-5 rounded-xl font-semibold text-sm sm:text-base bg-[#111215] border border-[#22242a] text-[#D1D5DB] hover:bg-[#181a20] hover:text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
            >
              <KeyRound className="w-4 h-4 text-[#8E929B]" strokeWidth={2} />
              <span className="tracking-wide">Ingressar com código</span>
            </button>

            {/* Footer Support Text with Lock Icon centered directly BELOW the text */}
            <div className="pt-4 flex flex-col items-center text-center gap-2 text-[#606470]">
              <p className="text-[11px] leading-relaxed max-w-[280px]">
                Sincronização multi-dispositivos com criptografia de ponta a ponta para privacidade total da sua família.
              </p>
              <Lock className="w-3.5 h-3.5 text-emerald-500/70" />
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
                className="w-full py-4 px-5 rounded-xl font-semibold text-sm sm:text-base bg-[#6E5440] hover:bg-[#7E624B] active:bg-[#5A4535] text-[#FFFDF5] border border-[#8A6F57]/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FFFDF5]" />
                    <span className="text-[#FFFDF5]">Decifrando e entrando...</span>
                  </>
                ) : (
                  <>
                    <span className="text-[#FFFDF5]">Entrar na Família</span>
                    <ArrowRight className="w-4 h-4 text-[#FFFDF5]" />
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
              className="w-full py-4 px-5 rounded-xl font-semibold text-sm sm:text-base bg-[#6E5440] hover:bg-[#7E624B] active:bg-[#5A4535] text-[#FFFDF5] border border-[#8A6F57]/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/50"
            >
              <span className="text-[#FFFDF5]">Já guardei a chave</span>
              <ArrowRight className="w-4 h-4 text-[#FFFDF5]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import {
  KeyRound,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  Shield,
} from 'lucide-react';
import { sanitizeMasterKey } from '../../services/tursoService';
import { OnboardingMode } from './useFamilyOnboarding';

export interface OnboardingStepsProps {
  mode: OnboardingMode;
  setMode: (mode: OnboardingMode) => void;
  inputCode: string;
  setInputCode: (code: string) => void;
  inputKey: string;
  setInputKey: (key: string) => void;
  createdCode: string;
  createdKey: string;
  isLoading: boolean;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  copiedCode: boolean;
  copiedKey: boolean;
  onCreateNewFamily: () => Promise<void>;
  onJoinFamily: (e: React.FormEvent) => Promise<void>;
  onCopy: (text: string, type: 'code' | 'key') => Promise<void>;
  onJoined: (familyId: string, masterKey: string) => void;
}

export const OnboardingSteps: React.FC<OnboardingStepsProps> = ({
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
  onCreateNewFamily,
  onJoinFamily,
  onCopy,
  onJoined,
}) => {
  return (
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
            onClick={onCreateNewFamily}
            className="w-full py-4 px-5 rounded-xl font-semibold text-sm sm:text-base bg-[#6E5440] hover:bg-[#7E624B] active:bg-[#5A4535] text-[#FFFDF5] border border-[#8A6F57]/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-black/50 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-[#FFFDF5]" />
                <span className="text-[#FFFDF5]">Criando chave segura...</span>
              </>
            ) : (
              <span className="text-[#FFFDF5] font-semibold tracking-wide">
                Novo Espaço Familiar
              </span>
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
              Sincronização multi-dispositivos com criptografia de ponta a ponta para privacidade
              total da sua família.
            </p>
            <Lock className="w-3.5 h-3.5 text-emerald-500/70" />
          </div>
        </div>
      )}

      {/* Mode: Join with Pairing Code + Master Key */}
      {mode === 'join' && (
        <form onSubmit={onJoinFamily} className="space-y-3.5 animate-fadeIn">
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
                  onClick={() => onCopy(createdCode, 'code')}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white p-1 rounded"
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
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
                  onClick={() => onCopy(createdKey, 'key')}
                  className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-white p-1 rounded"
                >
                  {copiedKey ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <div className="font-mono text-base font-bold tracking-widest text-amber-200">
                {createdKey}
              </div>
            </div>

            {/* Warning Notice */}
            <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-200/90 leading-relaxed">
              ⚠️ <strong>Guarde esta chave em segurança.</strong> Ela é a única forma de decifrar e
              sincronizar seus dados em outro aparelho. O servidor não guarda cópia da sua chave
              mestre.
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
  );
};

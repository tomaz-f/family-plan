import React, { useState } from 'react';
import { Check, Copy, KeyRound, LogOut, QrCode, ShieldCheck } from 'lucide-react';
import { AppLanguage, AppState } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';

interface FamilyVaultSyncSectionProps {
  state: AppState;
  language: AppLanguage;
  familyId?: string | null;
  masterKey?: string | null;
  onLeaveFamily?: () => void;
  onClose: () => void;
}

export const FamilyVaultSyncSection: React.FC<FamilyVaultSyncSectionProps> = ({
  state,
  language,
  familyId,
  masterKey,
  onLeaveFamily,
  onClose,
}) => {
  const t = TRANSLATIONS[language];

  const [copied, setCopied] = useState(false);
  const [familyCodeCopied, setFamilyCodeCopied] = useState(false);
  const [masterKeyCopied, setMasterKeyCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const primaryUrl = state.networkInfo?.primaryUrl || window.location.origin;

  const copyTextWithFallback = async (text: string, onDone: () => void) => {
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
      onDone();
    } catch {
      // ignore
    }
  };

  const handleCopyFamilyCode = (code: string) =>
    copyTextWithFallback(code, () => {
      setFamilyCodeCopied(true);
      setTimeout(() => setFamilyCodeCopied(false), 2500);
    });

  const handleCopyMasterKey = (key: string) =>
    copyTextWithFallback(key, () => {
      setMasterKeyCopied(true);
      setTimeout(() => setMasterKeyCopied(false), 2500);
    });

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(primaryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-4 pt-5 pb-8 space-y-4 animate-fadeIn">
      {familyId && (
        <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                {language === 'pt-BR'
                  ? 'Segurança e Pareamento Familiar'
                  : 'Family Security & Pairing'}
              </h4>
              <p className="text-xs text-slate-500">
                {language === 'pt-BR'
                  ? 'Criptografia de ponta a ponta (AES-256) ativa'
                  : 'End-to-end encryption (AES-256) active'}
              </p>
            </div>
          </div>

          {/* Pairing Code */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">
                {language === 'pt-BR' ? '1. Código da Família' : '1. Family Pairing Code'}
              </span>
              <code className="text-base font-black tracking-widest text-slate-900 font-mono select-all">
                {familyId}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopyFamilyCode(familyId)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
            >
              {familyCodeCopied ? <Check size={14} /> : <Copy size={14} />}
              <span>
                {familyCodeCopied
                  ? language === 'pt-BR'
                    ? 'Copiado!'
                    : 'Copied!'
                  : language === 'pt-BR'
                  ? 'Copiar'
                  : 'Copy'}
              </span>
            </button>
          </div>

          {/* Master Key */}
          {masterKey && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-0.5">
                    <KeyRound size={12} />
                    {language === 'pt-BR'
                      ? '2. Chave Mestre de Segurança (E2EE)'
                      : '2. Master Security Key (E2EE)'}
                  </span>
                  <code className="text-xs font-bold tracking-wider text-slate-800 font-mono break-all select-all">
                    {masterKey}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyMasterKey(masterKey)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                >
                  {masterKeyCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>
                    {masterKeyCopied
                      ? language === 'pt-BR'
                        ? 'Copiada!'
                        : 'Copied!'
                      : language === 'pt-BR'
                      ? 'Copiar Chave'
                      : 'Copy Key'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {language === 'pt-BR'
                  ? 'Compartilhe o Código da Família e a Chave Mestre apenas com seu parceiro(a).'
                  : 'Share the Family Code and Master Key only with your partner.'}
              </p>
            </div>
          )}

          {/* Disconnect / Leave Family */}
          {onLeaveFamily && (
            <div className="pt-2 border-t border-slate-200">
              {!showLeaveConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors py-1"
                >
                  <LogOut size={14} />
                  <span>
                    {language === 'pt-BR'
                      ? 'Desconectar / Trocar de Família'
                      : 'Disconnect / Switch Family'}
                  </span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
                  <p className="text-xs font-bold text-rose-400">
                    {language === 'pt-BR'
                      ? 'Tem certeza que deseja sair deste espaço familiar neste aparelho?'
                      : 'Are you sure you want to disconnect from this family space on this device?'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLeaveConfirm(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold"
                    >
                      {language === 'pt-BR' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLeaveFamily();
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 shadow-sm"
                    >
                      {language === 'pt-BR' ? 'Sim, desconectar' : 'Yes, disconnect'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Local Wi-Fi QR Code & LAN URLs Card */}
      <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
            <QrCode size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">{t.openOnYourPhone}</h4>
            <p className="text-xs text-slate-500">{t.openOnPhoneDesc}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
          {state.networkInfo?.qrCodeDataUrl ? (
            <img
              src={state.networkInfo.qrCodeDataUrl}
              alt="Scan to open on phone"
              className="w-40 h-40 rounded-xl border border-slate-200 bg-white p-2 shrink-0 shadow-xs"
            />
          ) : (
            <div className="w-40 h-40 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xs text-slate-400 text-center p-4">
              QR Code
            </div>
          )}

          <div className="w-full flex items-center gap-2 pt-1">
            <code className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-semibold text-slate-800 truncate select-all">
              {primaryUrl}
            </code>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shrink-0"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t.copiedBtn : t.copyBtn}
            </button>
          </div>
        </div>

        {state.networkInfo?.lanUrls && state.networkInfo.lanUrls.length > 1 && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <p className="font-semibold text-slate-700">{t.availableAdapters}</p>
            {state.networkInfo.lanUrls.map((item) => (
              <div
                key={item.url}
                className="flex items-center justify-between text-slate-600"
              >
                <span>{item.name}</span>
                <code className="font-mono font-semibold text-slate-800">{item.url}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

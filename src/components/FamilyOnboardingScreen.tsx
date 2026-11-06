import React from 'react';
import { OnboardingSteps } from './onboarding/OnboardingSteps';
import { useFamilyOnboarding } from './onboarding/useFamilyOnboarding';

export { OnboardingSteps } from './onboarding/OnboardingSteps';
export type { OnboardingStepsProps } from './onboarding/OnboardingSteps';
export type { OnboardingMode, UseFamilyOnboardingParams } from './onboarding/useFamilyOnboarding';

export interface FamilyOnboardingScreenProps {
  onJoined: (familyId: string, masterKey: string) => void;
  initialError?: string | null;
  initialFamilyId?: string | null;
}

export const FamilyOnboardingScreen: React.FC<FamilyOnboardingScreenProps> = ({
  onJoined,
  initialError,
  initialFamilyId,
}) => {
  const {
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
  } = useFamilyOnboarding({
    onJoined,
    initialError,
    initialFamilyId,
  });

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
      <OnboardingSteps
        mode={mode}
        setMode={setMode}
        inputCode={inputCode}
        setInputCode={setInputCode}
        inputKey={inputKey}
        setInputKey={setInputKey}
        createdCode={createdCode}
        createdKey={createdKey}
        isLoading={isLoading}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
        copiedCode={copiedCode}
        copiedKey={copiedKey}
        onCreateNewFamily={handleCreateNewFamily}
        onJoinFamily={handleJoinFamily}
        onCopy={handleCopy}
        onJoined={onJoined}
      />
    </div>
  );
};

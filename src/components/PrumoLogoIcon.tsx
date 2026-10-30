import React from 'react';

interface PrumoLogoIconProps {
  className?: string;
  style?: React.CSSProperties;
  animate?: boolean;
  size?: number; // Height in pixels (e.g. 30, 32)
}

export const PrumoLogoIcon: React.FC<PrumoLogoIconProps> = ({
  className = 'h-8 w-auto',
  style,
  animate = true,
  size,
}) => {
  const dynamicStyle: React.CSSProperties = {
    overflow: 'visible',
    ...(size ? { height: `${size}px`, width: 'auto' } : {}),
    ...style,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="6 -2 20 37"
      className={`block shrink-0 select-none overflow-visible ${className}`}
      style={dynamicStyle}
      aria-label="Prumo"
      role="img"
    >
      <defs>
        {/* Rustic oxidized iron gradient - illuminated left facet */}
        <linearGradient id="headerPrumoIronLight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7E624B" />
          <stop offset="45%" stopColor="#9C7F6A" />
          <stop offset="85%" stopColor="#6E5440" />
          <stop offset="100%" stopColor="#4A3728" />
        </linearGradient>

        {/* Rustic deep cast iron gradient - shaded right facet */}
        <linearGradient id="headerPrumoIronDark" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3D2B1E" />
          <stop offset="50%" stopColor="#24170E" />
          <stop offset="100%" stopColor="#0F0A06" />
        </linearGradient>

        {/* Warm jute / linen rope cord gradient */}
        <linearGradient id="headerPrumoRope" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D0B595" />
          <stop offset="50%" stopColor="#E7CDAC" />
          <stop offset="100%" stopColor="#A68969" />
        </linearGradient>

        {animate && (
          <style>{`
            .prumo-header-bob {
              animation: prumoCalmSway 4.2s ease-in-out infinite;
              transform-origin: 16px 0px;
            }
            @keyframes prumoCalmSway {
              0%, 100% {
                transform: translateY(-0.8px);
              }
              50% {
                transform: translateY(0.8px);
              }
            }
          `}</style>
        )}
      </defs>

      <g className={animate ? 'prumo-header-bob' : undefined}>
        {/* Upper Hanging Cord - extends upward into the header without clipping */}
        <line
          x1="16"
          y1="-14"
          x2="16"
          y2="8"
          stroke="url(#headerPrumoRope)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Cord Twine Texture Marks */}
        <line x1="15" y1="-1" x2="17" y2="0" stroke="#846B4E" strokeWidth="0.7" strokeLinecap="round" />
        <line x1="15" y1="2.5" x2="17" y2="3.5" stroke="#846B4E" strokeWidth="0.7" strokeLinecap="round" />

        {/* Rustic Tied Knot */}
        <ellipse cx="16" cy="7.8" rx="2.5" ry="1.9" fill="#8C7051" />
        <path d="M 14.2 7 C 14.6 8.8 17.4 8.8 17.8 7 Z" fill="#D0B595" />
        <circle cx="15.5" cy="7.9" r="0.8" fill="#5E4730" />

        {/* Iron Eyelet Ring (Dual Tone Ring) */}
        <circle
          cx="16"
          cy="12"
          r="3.4"
          fill="none"
          stroke="url(#headerPrumoIronLight)"
          strokeWidth="1.9"
        />
        <circle
          cx="16"
          cy="12"
          r="3.4"
          fill="none"
          stroke="url(#headerPrumoIronDark)"
          strokeWidth="1.9"
          strokeDasharray="0, 11"
        />

        {/* Neck / Collar Collar Ring */}
        <ellipse cx="16" cy="15.6" rx="3.2" ry="1.1" fill="url(#headerPrumoIronLight)" />
        <ellipse cx="16" cy="16.4" rx="2.4" ry="0.8" fill="url(#headerPrumoIronDark)" />

        {/* Upper Conical Shoulders */}
        <path d="M 16 16.4 L 8 19.2 L 16 19.2 Z" fill="url(#headerPrumoIronLight)" />
        <path d="M 16 16.4 L 16 19.2 L 24 19.2 Z" fill="url(#headerPrumoIronDark)" />

        {/* Main Lower Conical Body (Weight) */}
        <path d="M 8 19.2 L 16 33.2 L 16 19.2 Z" fill="url(#headerPrumoIronLight)" />
        <path d="M 16 19.2 L 16 33.2 L 24 19.2 Z" fill="url(#headerPrumoIronDark)" />

        {/* Bottom Precision Tip Highlight */}
        <circle cx="16" cy="33.2" r="0.75" fill="#FFFDF5" opacity="0.9" />
      </g>
    </svg>
  );
};

export default PrumoLogoIcon;

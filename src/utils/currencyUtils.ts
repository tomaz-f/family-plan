export const getAdaptiveMiniCardFontSize = (valueStr: string): string => {
  const len = valueStr.length;
  if (len <= 10) return 'text-xl sm:text-2xl font-black'; // e.g. "R$ 968,56"
  if (len <= 13) return 'text-lg sm:text-xl font-black'; // e.g. "R$ 12.345,67"
  if (len <= 16) return 'text-base sm:text-lg font-extrabold'; // e.g. "R$ 123.456,78"
  return 'text-sm sm:text-base font-bold'; // Extreme values (> R$ 1.000.000)
};

export const getAdaptiveFeedFontSize = (valueStr: string): string => {
  const len = valueStr.length;
  if (len <= 11) return 'text-base sm:text-lg font-black'; // e.g. "-R$ 75,00"
  if (len <= 14) return 'text-sm sm:text-base font-extrabold'; // e.g. "-R$ 12.345,00"
  return 'text-xs sm:text-sm font-bold';
};

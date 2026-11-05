/** Deterministic number formatting for count-ups (tabular figures recommended). */
export const formatCount = (value: number, options: {decimals?: number; pad?: number} = {}): string => {
  const {decimals = 0, pad = 0} = options;
  const fixed = value.toFixed(decimals);
  if (pad <= 0) return fixed;
  const [int, frac] = fixed.split('.');
  return int.padStart(pad, '0') + (frac ? `.${frac}` : '');
};

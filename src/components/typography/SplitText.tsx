import React from 'react';

type Props = {
  readonly text: string;
  /** Split into characters (default) or words. */
  readonly by?: 'char' | 'word';
  /** Style for unit `i` of `count`. Called every frame - keep it pure. */
  readonly unitStyle: (i: number, count: number, unit: string) => React.CSSProperties;
  readonly style?: React.CSSProperties;
  readonly className?: string;
};

/**
 * Splits text into individually animatable inline-blocks. Units keep their
 * natural advance widths, so kerning-sensitive display type stays tight.
 */
export const SplitText: React.FC<Props> = ({text, by = 'char', unitStyle, style, className}) => {
  const units = by === 'char' ? Array.from(text) : text.split(/(\s+)/).filter((u) => u.length > 0);
  const animated = units.filter((u) => u.trim().length > 0);
  let k = 0;
  return (
    <span className={className} style={{display: 'inline-block', whiteSpace: 'pre', ...style}}>
      {units.map((unit, i) => {
        if (unit.trim().length === 0) {
          return <span key={i}>{unit}</span>;
        }
        const index = k++;
        return (
          <span key={i} style={{display: 'inline-block', ...unitStyle(index, animated.length, unit)}}>
            {unit}
          </span>
        );
      })}
    </span>
  );
};

import React from 'react';

/**
 * Clips content along one edge only, so text can rise out of (or sink into)
 * an invisible line without its other edges being cropped.
 * `edge` is the side that clips: 'bottom' => content can rise from below.
 */
export const Mask: React.FC<{
  readonly edge: 'top' | 'bottom' | 'both';
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}> = ({edge, children, style}) => {
  const clipPath =
    edge === 'bottom'
      ? 'inset(-0.5em -0.5em 0 -0.5em)'
      : edge === 'top'
        ? 'inset(0 -0.5em -0.5em -0.5em)'
        : 'inset(0 -0.5em 0 -0.5em)';
  return <div style={{clipPath, ...style}}>{children}</div>;
};

import React from 'react';

/**
 * Stroke-draw any SVG path from 0 to `progress` (0..1) using a normalised
 * pathLength, so it works for any geometry without measuring. Once complete
 * the dash pattern is dropped (dashed strokes are costly to rasterise).
 */
export const DrawPath: React.FC<
  {readonly d: string; readonly progress: number} & React.SVGProps<SVGPathElement>
> = ({d, progress, ...rest}) => {
  if (progress <= 0) return null;
  if (progress >= 1) return <path d={d} fill="none" {...rest} />;
  return (
    <path
      d={d}
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - progress}
      fill="none"
      {...rest}
    />
  );
};

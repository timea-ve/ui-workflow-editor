import type { CSSProperties } from 'react';
import type { KitItemDef, VisualStyle } from './types';

/** Renders one kit item at a given size. Used by the gallery and (later) the canvas nodes. */
export function KitItemView({
  def, props, w, h, style, seed, className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: KitItemDef<any>;
  props?: Record<string, unknown>;
  w?: number;
  h?: number;
  style: VisualStyle;
  seed: number;
  className?: string;
}) {
  const width = w ?? def.defaultSize.w;
  const height = h ?? def.defaultSize.h;
  const merged = { ...def.defaultProps, ...props };
  const box: CSSProperties = { position: 'relative', width, height };
  return (
    <div className={className} style={box} role="img" aria-label={def.describe(merged)} data-kit-style={style}>
      {def.render(merged, { w: width, h: height, style, seed })}
    </div>
  );
}

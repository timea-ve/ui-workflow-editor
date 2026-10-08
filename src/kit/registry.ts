import type { ElementType } from '../model/types';
import type { KitItemDef } from './types';
import { wireframeKit } from './wireframe';
import { diagramKit } from './diagram';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const kitRegistry: Map<ElementType, KitItemDef<any>> = new Map(
  [...wireframeKit, ...diagramKit].map((d) => [d.type, d]),
);

export { wireframeKit, diagramKit };

/** Stable numeric seed from an id, for sketchy strokes. */
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647 || 1;
}

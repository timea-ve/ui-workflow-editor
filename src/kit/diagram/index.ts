import type { KitItemDef } from '../types';
import { rect } from './rect';
import { diamond } from './diamond';
import { ellipse } from './ellipse';
import { sticky } from './sticky';
import { label } from './label';

// Owner: Diagram & Flow agent. Register every diagram shape here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const diagramKit: KitItemDef<any>[] = [rect, diamond, ellipse, sticky, label];

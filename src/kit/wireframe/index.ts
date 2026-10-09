import type { KitItemDef } from '../types';
import { header } from './header';
import { nav } from './nav';
import { button } from './button';
import { input } from './input';
import { checkbox } from './checkbox';
import { toggle } from './toggle';
import { dropdown } from './dropdown';
import { card } from './card';
import { list } from './list';
import { table } from './table';
import { image } from './image';
import { text } from './text';
import { heading } from './heading';
import { modal } from './modal';
import { tabs } from './tabs';
import { icon } from './icon';
import { setA } from './setA';
import { setB } from './setB';

// Owner: Wireframe Kit agent. Register every wireframe component here.
// Order = order in the insert palette and gallery (structure → inputs → content → overlays).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const wireframeKit: KitItemDef<any>[] = [
  header, nav, tabs, heading, text, button, input, checkbox, toggle, dropdown,
  card, list, table, image, icon, modal,
  ...setA, ...setB,
];

export { DeviceFrame, deviceContentInset } from './DeviceFrame';

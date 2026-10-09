import type { KitItemDef } from '../types';
import { caption } from './caption';
import { link } from './link';
import { iconButton } from './icon-button';
import { fab } from './fab';
import { textarea } from './textarea';
import { search } from './search';
import { radio } from './radio';
import { slider } from './slider';
import { datepicker } from './datepicker';

// Owner: Kit set A agent (text, actions, inputs). Register new components here; the Orchestrator sets the final palette order.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setA: KitItemDef<any>[] = [caption, link, iconButton, fab, textarea, search, radio, slider, datepicker];

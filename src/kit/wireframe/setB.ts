import type { KitItemDef } from '../types';
import { sidebar } from './sidebar';
import { menu } from './menu';
import { breadcrumbs } from './breadcrumbs';
import { pagination } from './pagination';
import { video } from './video';
import { avatar } from './avatar';
import { calendar } from './calendar';
import { lineChart } from './line-chart';
import { stackedChart } from './stacked-chart';
import { divider } from './divider';
import { tooltip } from './tooltip';
import { toast } from './toast';
import { badge } from './badge';
import { progress } from './progress';
import { spinner } from './spinner';

// Owner: Kit set B agent (navigation, content, feedback). Register new components here; the Orchestrator sets the final palette order.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setB: KitItemDef<any>[] = [
  // navigation
  sidebar, menu, breadcrumbs, pagination,
  // content
  avatar, video, divider, calendar, lineChart, stackedChart,
  // feedback
  tooltip, toast, badge, progress, spinner,
];

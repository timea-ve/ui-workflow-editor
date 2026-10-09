// Starter templates shown on the dashboard. Each `build()` returns a fresh BoardDoc made only with
// src/flow/ops.ts, so ids are new every time and the result can be written straight to a new board.
import type { BoardDoc } from '../../model/types';
import { buildCheckout } from './checkout';
import { buildOnboarding } from './onboarding';
import { buildSearch } from './search';
import { buildSettings } from './settings';
import { buildSignup } from './signup';

export type TemplateId = 'signup' | 'onboarding' | 'checkout' | 'settings' | 'search';

export interface TemplateDef {
  id: TemplateId;
  name: string;
  description: string;
  screenCount: number;
  build(): BoardDoc;
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'signup', name: 'Sign-up', description: 'Welcome, sign-up form and success, with an “email taken” branch.', screenCount: 4, build: buildSignup },
  { id: 'onboarding', name: 'Onboarding', description: 'Two intro slides, pick interests, and a Skip path.', screenCount: 4, build: buildOnboarding },
  { id: 'checkout', name: 'Checkout', description: 'Cart, shipping, payment and order confirmation.', screenCount: 4, build: buildCheckout },
  { id: 'settings', name: 'Settings', description: 'Settings list, account details, notifications and log out.', screenCount: 4, build: buildSettings },
  { id: 'search', name: 'Search', description: 'Search, results, an article and a filters panel.', screenCount: 4, build: buildSearch },
];

export function getTemplate(id: string | undefined): TemplateDef | undefined {
  return id ? TEMPLATES.find((t) => t.id === id) : undefined;
}

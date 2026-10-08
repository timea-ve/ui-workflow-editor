import type { BoardDoc } from '../../model/types';
import { M, TemplateBuilder } from './builder';

/** Mobile sign-up: Welcome → Sign up → (Email available?) → Success / Email taken. */
export function buildSignup(): BoardDoc {
  const b = new TemplateBuilder('mobile');
  const welcome = b.screen('Welcome', 0, { isStart: true });
  const signup = b.screen('Sign up', 1);
  const success = b.screen('Account created', 2);
  const taken = b.screen('Email taken', 2, { row: 1 });

  // Welcome
  b.el(welcome, 'image', M.x, 140, M.w, 220, { alt: 'Product illustration' });
  b.el(welcome, 'heading', M.x, 392, M.w, 40, { text: 'Plan flows together', level: 'H1', align: 'center' });
  b.el(welcome, 'text', M.x, 444, M.w, 48, { text: 'Create a free account to save and share your work.', align: 'center', tone: 'muted' });
  const createCta = b.el(welcome, 'button', M.x, 656, M.w, 48, { label: 'Create account', variant: 'primary' });
  b.el(welcome, 'text', M.x, 720, M.w, 32, { text: 'I already have an account', size: 'sm', align: 'center' });

  // Sign up form
  b.el(signup, 'header', 0, M.top, 375, 56, { title: 'Sign up', leading: 'back', action: 'none' });
  b.el(signup, 'heading', M.x, 124, M.w, 40, { text: 'Create your account', level: 'H2' });
  b.el(signup, 'input', M.x, 184, M.w, 64, { label: 'Name', placeholder: 'Alex Morgan' });
  b.el(signup, 'input', M.x, 264, M.w, 64, { label: 'Email', placeholder: 'you@example.com' });
  b.el(signup, 'input', M.x, 344, M.w, 64, { label: 'Password', placeholder: 'At least 8 characters' });
  b.el(signup, 'checkbox', M.x, 432, M.w, 24, { label: 'I agree to the terms', checked: true });
  const submit = b.el(signup, 'button', M.x, M.footer, M.w, 48, { label: 'Create account', variant: 'primary' });

  // Success
  b.el(success, 'icon', 147, 240, 80, 80, { glyph: 'check', name: 'Success' });
  b.el(success, 'heading', M.x, 352, M.w, 40, { text: "You're all set", level: 'H1', align: 'center' });
  b.el(success, 'text', M.x, 404, M.w, 48, { text: 'We sent a confirmation link to your inbox.', align: 'center', tone: 'muted' });
  b.el(success, 'button', M.x, M.footer, M.w, 48, { label: 'Get started', variant: 'primary' });

  // Error path
  b.el(taken, 'header', 0, M.top, 375, 56, { title: 'Sign up', leading: 'back', action: 'none' });
  b.el(taken, 'heading', M.x, 124, M.w, 40, { text: 'Create your account', level: 'H2' });
  b.el(taken, 'input', M.x, 184, M.w, 64, { label: 'Email', placeholder: 'alex@example.com' });
  b.el(taken, 'text', M.x, 256, M.w, 44, { text: 'This email already has an account. Log in or use another email.', size: 'sm' });
  const retry = b.el(taken, 'button', M.x, M.footer, M.w, 48, { label: 'Try again', variant: 'primary' });

  b.link(createCta, signup);
  b.link(submit, success);
  b.link(retry, signup);

  // Decision: drawn below "Sign up", feeding the happy path and the error path.
  const decision = b.shape('diamond', b.colX(1) + (375 - 160) / 2, 812 + 100, 160, 110, { label: 'Email available?' });
  b.connect(signup, decision, { label: 'Submit', fromAnchor: 'bottom', toAnchor: 'top' });
  b.connect(decision, success, { label: 'Yes', fromAnchor: 'right', toAnchor: 'bottom' });
  b.connect(decision, taken, { label: 'No', fromAnchor: 'bottom', toAnchor: 'left' });
  return b.doc;
}

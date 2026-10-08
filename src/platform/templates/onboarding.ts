import type { BoardDoc } from '../../model/types';
import { M, TemplateBuilder } from './builder';

/** Mobile onboarding: two intro slides → pick interests → ready. "Skip" jumps to the end. */
export function buildOnboarding(): BoardDoc {
  const b = new TemplateBuilder('mobile');
  const intro = b.screen('Intro', 0, { isStart: true });
  const how = b.screen('How it works', 1);
  const interests = b.screen('Your interests', 2);
  const ready = b.screen('Ready', 3);

  const slide = (frame: string, alt: string, title: string, body: string, step: string) => {
    b.el(frame, 'image', M.x, 120, M.w, 260, { alt });
    b.el(frame, 'heading', M.x, 412, M.w, 40, { text: title, level: 'H1', align: 'center' });
    b.el(frame, 'text', M.x, 464, M.w, 48, { text: body, align: 'center', tone: 'muted' });
    b.el(frame, 'text', M.x, 640, M.w, 24, { text: step, size: 'sm', align: 'center', tone: 'muted' });
  };

  slide(intro, 'Illustration: sketching screens', 'Sketch your idea', 'Draw rough screens in seconds. No design skills needed.', 'Step 1 of 3');
  const skip = b.el(intro, 'text', 271, 56, 80, 28, { text: 'Skip', size: 'sm', align: 'right' });
  const next1 = b.el(intro, 'button', M.x, M.footer, M.w, 48, { label: 'Next', variant: 'primary' });

  slide(how, 'Illustration: linked screens', 'Link it into a flow', 'Connect buttons to screens, then click through it like a prototype.', 'Step 2 of 3');
  const next2 = b.el(how, 'button', M.x, M.footer, M.w, 48, { label: 'Next', variant: 'primary' });

  b.el(interests, 'heading', M.x, 104, M.w, 40, { text: 'What will you sketch?', level: 'H2' });
  b.el(interests, 'text', M.x, 152, M.w, 44, { text: 'Pick a few. You can change this later.', size: 'sm', tone: 'muted' });
  ['Product features', 'Websites', 'Mobile apps', 'Team workshops'].forEach((label, i) => {
    b.el(interests, 'checkbox', M.x, 220 + i * 44, M.w, 24, { label, checked: i < 2 });
  });
  b.el(interests, 'toggle', M.x, 420, M.w, 32, { label: 'Send me tips by email', on: false });
  b.el(interests, 'text', M.x, 640, M.w, 24, { text: 'Step 3 of 3', size: 'sm', align: 'center', tone: 'muted' });
  const cont = b.el(interests, 'button', M.x, M.footer, M.w, 48, { label: 'Continue', variant: 'primary' });

  b.el(ready, 'icon', 147, 240, 80, 80, { glyph: 'star', name: 'Ready' });
  b.el(ready, 'heading', M.x, 352, M.w, 40, { text: "You're ready", level: 'H1', align: 'center' });
  b.el(ready, 'text', M.x, 404, M.w, 48, { text: 'Start with a blank board or pick a template.', align: 'center', tone: 'muted' });
  b.el(ready, 'button', M.x, M.footer, M.w, 48, { label: 'Create my first board', variant: 'primary' });

  b.link(next1, how);
  b.link(next2, interests);
  b.link(cont, ready);
  b.link(skip, ready);
  return b.doc;
}

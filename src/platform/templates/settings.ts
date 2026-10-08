import type { BoardDoc } from '../../model/types';
import { M, TemplateBuilder } from './builder';

/** Mobile settings: menu → Account / Notifications, plus a log-out confirmation. */
export function buildSettings(): BoardDoc {
  const b = new TemplateBuilder('mobile');
  const home = b.screen('Settings', 0, { isStart: true });
  const account = b.screen('Account', 1);
  const notifications = b.screen('Notifications', 2);
  const logout = b.screen('Log out?', 3);

  b.el(home, 'header', 0, M.top, 375, 56, { title: 'Settings', leading: 'none', action: 'none' });
  const row = (label: string, i: number) =>
    b.el(home, 'list', M.x, 120 + i * 56, M.w, 56, { count: 1, items: label, showAvatar: false, showChevron: true });
  const accountRow = row('Account', 0);
  const notifRow = row('Notifications', 1);
  row('Privacy', 2);
  row('Help & feedback', 3);
  const logoutBtn = b.el(home, 'button', M.x, 376, M.w, 48, { label: 'Log out', variant: 'secondary' });
  b.el(home, 'nav', 0, 724, 375, 64, { items: 'Home, Search, Saved, Settings', active: 3, showIcons: true });

  b.el(account, 'header', 0, M.top, 375, 56, { title: 'Account', leading: 'back', action: 'none' });
  b.el(account, 'image', 147, 124, 80, 80, { alt: 'Profile photo', shape: 'circle' });
  b.el(account, 'input', M.x, 228, M.w, 64, { label: 'Name', placeholder: 'Alex Morgan' });
  b.el(account, 'input', M.x, 308, M.w, 64, { label: 'Email', placeholder: 'alex@example.com' });
  b.el(account, 'dropdown', M.x, 388, M.w, 64, { label: 'Language', value: 'English', options: 'English, Deutsch, Français' });
  const save = b.el(account, 'button', M.x, M.footer, M.w, 48, { label: 'Save changes', variant: 'primary' });

  const notifHeader = b.el(notifications, 'header', 0, M.top, 375, 56, { title: 'Notifications', leading: 'back', action: 'none' });
  [['Push notifications', true], ['Email updates', true], ['Product tips', false], ['Weekly summary', true]].forEach(([label, on], i) => {
    b.el(notifications, 'toggle', M.x, 124 + i * 48, M.w, 32, { label, on });
  });
  b.el(notifications, 'text', M.x, 324, M.w, 44, { text: 'You can change these any time.', size: 'sm', tone: 'muted' });

  b.el(logout, 'header', 0, M.top, 375, 56, { title: 'Settings', leading: 'none', action: 'none' });
  const dialog = b.el(logout, 'modal', 32, 296, 311, 220, {
    title: 'Log out?', body: "You'll need to sign in again to see your boards.", primary: 'Log out', secondary: 'Cancel', showClose: false,
  });

  b.link(accountRow, account);
  b.link(notifRow, notifications);
  b.link(logoutBtn, logout);
  b.link(save, home);
  b.link(notifHeader, home);
  b.link(dialog, home);
  return b.doc;
}

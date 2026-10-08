import type { BoardDoc, ID } from '../../model/types';
import { TemplateBuilder } from './builder';

/** Desktop help-centre search: Home → Results → Article, with a Filters side path. */
export function buildSearch(): BoardDoc {
  const b = new TemplateBuilder('desktop');
  const home = b.screen('Search home', 0, { isStart: true });
  const results = b.screen('Results', 1);
  const article = b.screen('Article', 2);
  const filters = b.screen('Filters', 1, { row: 1 });

  const chrome = (frame: ID, leading: 'menu' | 'back') =>
    b.el(frame, 'header', 0, 44, 1280, 56, { title: 'Acme Help', leading, action: 'user' });

  chrome(home, 'menu');
  b.el(home, 'heading', 340, 220, 600, 48, { text: 'How can we help?', level: 'H1', align: 'center' });
  b.el(home, 'input', 340, 288, 600, 64, { label: 'Search', placeholder: 'Search articles…', showLabel: false });
  const go = b.el(home, 'button', 540, 372, 200, 48, { label: 'Search', variant: 'primary' });
  b.el(home, 'text', 340, 440, 600, 24, { text: 'Popular: billing, export, sharing', size: 'sm', align: 'center', tone: 'muted' });

  chrome(results, 'menu');
  b.el(results, 'input', 64, 124, 720, 64, { label: 'Search', placeholder: 'export', showLabel: false });
  const openFilters = b.el(results, 'button', 808, 132, 160, 48, { label: 'Filters', variant: 'secondary' });
  b.el(results, 'text', 64, 204, 720, 24, { text: '3 results for “export”', size: 'sm', tone: 'muted' });
  const hit = b.el(results, 'list', 64, 240, 720, 56, { count: 1, items: 'Export a board as PDF', showAvatar: false, showChevron: true });
  b.el(results, 'list', 64, 296, 720, 112, { count: 2, items: 'Export to PNG, Share a read-only link', showAvatar: false, showChevron: true });

  const back = chrome(article, 'back');
  b.el(article, 'heading', 64, 136, 720, 40, { text: 'Export a board as PDF', level: 'H1' });
  b.el(article, 'text', 64, 192, 720, 72, { text: 'Open the board, choose Export, then pick PDF. Each screen becomes one page, in flow order.' });
  b.el(article, 'image', 64, 288, 720, 300, { alt: 'Screenshot of the export dialog' });
  b.el(article, 'card', 848, 136, 368, 160, { title: 'Related: Export to PNG', body: 'Save a picture of the whole board or just a selection.', hasImage: false });

  chrome(filters, 'menu');
  b.el(filters, 'heading', 64, 136, 560, 40, { text: 'Filters', level: 'H2' });
  b.el(filters, 'dropdown', 64, 192, 400, 64, { label: 'Category', value: 'All categories', options: 'All categories, Boards, Sharing, Billing' });
  ['Guides', 'Video tutorials', 'Release notes'].forEach((label, i) => {
    b.el(filters, 'checkbox', 64, 280 + i * 40, 400, 24, { label, checked: i === 0 });
  });
  const apply = b.el(filters, 'button', 64, 420, 180, 48, { label: 'Apply filters', variant: 'primary' });
  b.el(filters, 'button', 260, 420, 140, 48, { label: 'Reset', variant: 'secondary' });

  b.link(go, results);
  b.link(hit, article);
  b.link(openFilters, filters);
  b.link(apply, results);
  b.link(back, results);
  return b.doc;
}

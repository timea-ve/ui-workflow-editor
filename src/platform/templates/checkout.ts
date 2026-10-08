import type { BoardDoc, ID } from '../../model/types';
import { TemplateBuilder } from './builder';

/** Desktop checkout: Cart → Shipping → Payment → Confirmation. */
export function buildCheckout(): BoardDoc {
  const b = new TemplateBuilder('desktop');
  const cart = b.screen('Cart', 0, { isStart: true });
  const shipping = b.screen('Shipping', 1);
  const payment = b.screen('Payment', 2);
  const done = b.screen('Confirmation', 3);

  const chrome = (frame: ID) =>
    b.el(frame, 'header', 0, 44, 1280, 56, { title: 'Acme Store', leading: 'menu', action: 'user' });
  const summary = (frame: ID, cta: string) => {
    b.el(frame, 'card', 848, 200, 368, 160, { title: 'Order summary', body: 'Subtotal €95 · Shipping free · Total €95', hasImage: false });
    return b.el(frame, 'button', 848, 384, 368, 48, { label: cta, variant: 'primary' });
  };

  chrome(cart);
  b.el(cart, 'heading', 64, 136, 720, 40, { text: 'Your cart', level: 'H1' });
  b.el(cart, 'list', 64, 200, 720, 168, { count: 3, items: 'Canvas tote · €24, Desk lamp · €59, Notebook set · €12', showAvatar: true, showChevron: false });
  const toShipping = summary(cart, 'Checkout');
  b.el(cart, 'text', 848, 448, 368, 24, { text: 'Continue shopping', size: 'sm', align: 'center' });

  chrome(shipping);
  b.el(shipping, 'heading', 64, 136, 720, 40, { text: 'Shipping address', level: 'H1' });
  b.el(shipping, 'input', 64, 200, 560, 64, { label: 'Full name', placeholder: 'Alex Morgan' });
  b.el(shipping, 'input', 64, 280, 560, 64, { label: 'Street address', placeholder: 'Main Street 1' });
  b.el(shipping, 'input', 64, 360, 272, 64, { label: 'City', placeholder: 'Vienna' });
  b.el(shipping, 'input', 352, 360, 272, 64, { label: 'Postal code', placeholder: '1010' });
  b.el(shipping, 'dropdown', 64, 440, 560, 64, { label: 'Country', value: 'Austria', options: 'Austria, Germany, Switzerland' });
  const toPayment = summary(shipping, 'Continue to payment');

  chrome(payment);
  b.el(payment, 'heading', 64, 136, 720, 40, { text: 'Payment', level: 'H1' });
  b.el(payment, 'tabs', 64, 200, 560, 44, { tabs: 'Card, PayPal, Bank transfer', active: 0 });
  b.el(payment, 'input', 64, 264, 560, 64, { label: 'Card number', placeholder: '1234 5678 9012 3456' });
  b.el(payment, 'input', 64, 344, 272, 64, { label: 'Expiry date', placeholder: 'MM / YY' });
  b.el(payment, 'input', 352, 344, 272, 64, { label: 'Security code', placeholder: '123' });
  b.el(payment, 'checkbox', 64, 432, 560, 24, { label: 'Save this card for next time', checked: false });
  const pay = summary(payment, 'Pay €95');

  chrome(done);
  b.el(done, 'icon', 600, 180, 80, 80, { glyph: 'check', name: 'Order confirmed' });
  b.el(done, 'heading', 340, 288, 600, 40, { text: 'Thanks for your order!', level: 'H1', align: 'center' });
  b.el(done, 'text', 340, 340, 600, 48, { text: 'Order #1042 is confirmed. A receipt is on its way to your inbox.', align: 'center', tone: 'muted' });
  b.el(done, 'button', 540, 420, 200, 48, { label: 'Continue shopping', variant: 'secondary' });

  b.link(toShipping, shipping);
  b.link(toPayment, payment);
  b.link(pay, done);
  return b.doc;
}

// Demo board for the sandbox: a 3-screen mobile sign-up flow, a few diagram shapes,
// and an "Option B" lane produced by duplicateAsOption. Built only with ops.

import type { BoardDoc, ID } from '../model/types';
import { addConnector, addElement, createScreen, duplicateAsOption, emptyDoc, linkElementToScreen, SCREEN_GAP } from './ops';

export interface SignupDemo {
  doc: BoardDoc;
  screens: { welcome: ID; signup: ID; success: ID };
  getStarted: ID;
  createAccount: ID;
}

export function buildSignupFlow(): SignupDemo {
  let doc = emptyDoc();
  const step = 375 + SCREEN_GAP;
  const add = <T extends { doc: BoardDoc }>(r: T) => { doc = r.doc; return r; };

  const welcome = add(createScreen(doc, { device: 'mobile', name: 'Welcome', x: 0, y: 0 })).id;
  const signup = add(createScreen(doc, { device: 'mobile', name: 'Sign up', x: step, y: 0 })).id;
  const success = add(createScreen(doc, { device: 'mobile', name: 'Success', x: step * 2, y: 0 })).id;

  // Welcome
  add(addElement(doc, { type: 'image', parentId: welcome, x: 32, y: 120, w: 311, h: 220, props: { alt: 'Hero illustration' } }));
  add(addElement(doc, { type: 'heading', parentId: welcome, x: 32, y: 380, w: 311, h: 40, props: { text: 'Welcome to Acme', level: 'H1' } }));
  add(addElement(doc, { type: 'text', parentId: welcome, x: 32, y: 430, w: 311, h: 48, props: { text: 'Plan, track and share in one place.' } }));
  const getStarted = add(addElement(doc, { type: 'button', parentId: welcome, x: 32, y: 680, w: 311, h: 48, props: { label: 'Get started', variant: 'primary' } })).id;

  // Sign up
  add(addElement(doc, { type: 'heading', parentId: signup, x: 32, y: 96, w: 311, h: 40, props: { text: 'Create your account', level: 'H1' } }));
  add(addElement(doc, { type: 'input', parentId: signup, x: 32, y: 176, w: 311, h: 64, props: { label: 'Email', placeholder: 'you@example.com' } }));
  add(addElement(doc, { type: 'input', parentId: signup, x: 32, y: 260, w: 311, h: 64, props: { label: 'Password', placeholder: '••••••••' } }));
  const createAccount = add(addElement(doc, { type: 'button', parentId: signup, x: 32, y: 680, w: 311, h: 48, props: { label: 'Create account', variant: 'primary' } })).id;

  // Success
  add(addElement(doc, { type: 'icon', parentId: success, x: 147, y: 260, w: 80, h: 80, props: { glyph: 'check', name: 'Success' } }));
  add(addElement(doc, { type: 'heading', parentId: success, x: 32, y: 370, w: 311, h: 40, props: { text: "You're in!", level: 'H1', align: 'center' } }));
  add(addElement(doc, { type: 'button', parentId: success, x: 32, y: 680, w: 311, h: 48, props: { label: 'Continue', variant: 'secondary' } }));

  add(linkElementToScreen(doc, getStarted, signup));
  add(linkElementToScreen(doc, createAccount, success));

  return { doc, screens: { welcome, signup, success }, getStarted, createAccount };
}

/** Full sandbox board: sign-up flow + diagram shapes + Option B lane. */
export function buildSandboxBoard(): BoardDoc {
  const demo = buildSignupFlow();
  let doc = demo.doc;
  const { welcome, signup, success } = demo.screens;

  const start = addElement(doc, { type: 'ellipse', x: 117, y: -170, w: 140, h: 56, props: { label: 'Start', shape: 'pill' } });
  doc = start.doc;
  doc = addConnector(doc, start.id, welcome, { fromAnchor: 'bottom', toAnchor: 'top' }).doc;

  const decision = addElement(doc, { type: 'diamond', x: 935, y: -230, w: 160, h: 110, props: { label: 'Email valid?' } });
  doc = decision.doc;
  doc = addConnector(doc, signup, decision.id, { label: 'submit', fromAnchor: 'top', toAnchor: 'left' }).doc;
  doc = addConnector(doc, decision.id, success, { label: 'yes', fromAnchor: 'right', toAnchor: 'top' }).doc;

  doc = addElement(doc, {
    type: 'sticky', x: -320, y: -260, w: 200, h: 150,
    props: { text: 'Goal: account in under 60s.\nOption B: try social login?' },
  }).doc;

  return duplicateAsOption(doc, [welcome, signup, success]).doc;
}

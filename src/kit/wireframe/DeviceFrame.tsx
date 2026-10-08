import type { ReactNode } from 'react';
import type { Device } from '../../model/types';
import type { VisualStyle } from '../types';
import { Box, KitText, SketchEllipse, SketchLines, SketchRect } from '../../design/primitives';
import { At, RoundedRect, TextRow } from './_helpers';

export interface ContentInset { top: number; right: number; bottom: number; left: number }

const INSETS: Record<Device, ContentInset> = {
  // Status bar with notch hint on top, home indicator at the bottom.
  mobile: { top: 44, right: 0, bottom: 24, left: 0 },
  // Rounded bezel with a slim status bar.
  tablet: { top: 28, right: 0, bottom: 20, left: 0 },
  // Browser bar: 3 dots + url pill.
  desktop: { top: 44, right: 0, bottom: 0, left: 0 },
};

const RADIUS: Record<Device, number> = { mobile: 36, tablet: 24, desktop: 8 };

/** Height reserved above the frame for the screen-name label (drawn outside the w×h box). */
export const DEVICE_TITLE_H = 24;

/** Offsets of the content area inside a device frame of the given type. */
export function deviceContentInset(device: Device): ContentInset {
  return { ...INSETS[device] };
}

/**
 * Lo-fi device chrome around a screen. The frame fills w×h; the screen name is
 * drawn just above it (outside the box) and children render inside the content area,
 * clipped to it. Position children relative to the content area's top-left.
 */
export function DeviceFrame({
  device, w, h, name, style, seed, children,
}: { device: Device; w: number; h: number; name: string; style: VisualStyle; seed: number; children?: ReactNode }) {
  const inset = INSETS[device];
  const radius = RADIUS[device];
  const cw = Math.max(0, w - inset.left - inset.right);
  const ch = Math.max(0, h - inset.top - inset.bottom);
  return (
    <div role="group" aria-label={`${name} (${device} screen)`} data-kit-style={style} style={{ position: 'relative', width: w, height: h }}>
      <Box x={0} y={-DEVICE_TITLE_H} w={w} h={DEVICE_TITLE_H - 4} style={{ display: 'flex', alignItems: 'flex-end' }}>
        <KitText size="sm" tone="muted" weight={600} style={{ fontFamily: 'var(--fs-ui-font)', flex: 1, minWidth: 0 }}>{name}</KitText>
      </Box>
      <RoundedRect w={w} h={h} radius={radius} style={style} seed={seed} fill="surface" strokeWidth={2} />
      <div aria-hidden>
        {device === 'mobile' && <MobileChrome w={w} h={h} style={style} seed={seed} />}
        {device === 'tablet' && <TabletChrome w={w} h={h} style={style} seed={seed} />}
        {device === 'desktop' && <DesktopChrome w={w} style={style} seed={seed} />}
      </div>
      <Box x={inset.left} y={inset.top} w={cw} h={ch} style={{ overflow: 'hidden' }}>{children}</Box>
    </div>
  );
}

type ChromeProps = { w: number; h: number; style: VisualStyle; seed: number };

function StatusBar({ w, h, style, seed, notch }: { w: number; h: number; style: VisualStyle; seed: number; notch: boolean }) {
  const pad = notch ? 28 : 20;
  const nw = Math.min(120, w * 0.32);
  return (
    <>
      <TextRow x={pad} w={60} h={h} size="sm" weight={700}>9:41</TextRow>
      {notch && w > nw + 140 && (
        <At x={(w - nw) / 2} y={10} w={nw} h={24}>
          <RoundedRect w={nw} h={24} radius={12} style={style} seed={seed + 1} fill="ink" />
        </At>
      )}
      {!notch && (
        <At x={w / 2 - 4} y={h / 2 - 4} w={8} h={8}>
          <SketchEllipse w={8} h={8} style={style} seed={seed + 1} stroke="muted" />
        </At>
      )}
      <At x={w - pad - 24} y={h / 2 - 6} w={24} h={12}>
        <SketchRect w={24} h={12} radius={3} style={style} seed={seed + 2} stroke="muted" />
      </At>
    </>
  );
}

function MobileChrome({ w, h, style, seed }: ChromeProps) {
  const bar = Math.min(134, w * 0.36);
  return (
    <>
      <StatusBar w={w} h={INSETS.mobile.top} style={style} seed={seed} notch />
      <SketchLines w={w} h={h} lines={[[[(w - bar) / 2, h - 10], [(w + bar) / 2, h - 10]]]} style={style} seed={seed + 4} strokeWidth={4} />
    </>
  );
}

function TabletChrome({ w, h, style, seed }: ChromeProps) {
  const bar = Math.min(200, w * 0.3);
  return (
    <>
      <StatusBar w={w} h={INSETS.tablet.top} style={style} seed={seed} notch={false} />
      <SketchLines w={w} h={h} lines={[[[(w - bar) / 2, h - 9], [(w + bar) / 2, h - 9]]]} style={style} seed={seed + 4} strokeWidth={4} />
    </>
  );
}

function DesktopChrome({ w, style, seed }: Omit<ChromeProps, 'h'>) {
  const top = INSETS.desktop.top;
  const pillW = Math.min(480, Math.max(0, w - 200));
  return (
    <>
      {[0, 1, 2].map((i) => (
        <At key={i} x={16 + i * 18} y={top / 2 - 6} w={12} h={12}>
          <SketchEllipse w={12} h={12} style={style} seed={seed + 1 + i} stroke="muted" />
        </At>
      ))}
      {pillW > 40 && (
        <At x={(w - pillW) / 2} y={10} w={pillW} h={top - 20}>
          <RoundedRect w={pillW} h={top - 20} radius={(top - 20) / 2} style={style} seed={seed + 5} stroke="muted" fill="none" />
          <TextRow x={16} w={pillW - 32} h={top - 20} size="sm" tone="muted" align="center">example.com</TextRow>
        </At>
      )}
      <SketchLines w={w} h={top} lines={[[[0, top], [w, top]]]} style={style} seed={seed + 8} stroke="muted" />
    </>
  );
}

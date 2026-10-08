import { Handle, Position } from '@xyflow/react';

const SIDES = [
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
] as const;

/**
 * Four connection handles (ids = anchor names). The canvas runs in ConnectionMode.Loose,
 * so every handle can both start and end a connector.
 */
export function SideHandles() {
  return (
    <>
      {SIDES.map(([id, pos]) => (
        <Handle key={id} id={id} type="source" position={pos} className="fs-handle" />
      ))}
    </>
  );
}

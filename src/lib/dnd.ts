import type { DragEvent } from 'react';

export const ITW_DRAG_TYPE = 'application/x-itw';

export type DragPayload =
  | { type: 'character' | 'monster'; id: string; name: string }
  | { type: 'prop'; id: string; name: string }
  | { type: 'particle'; id: string; name: string }
  | { type: 'model'; id: string; name: string }
  | { type: 'audio'; id: string; name: string; file?: string }
  | { type: 'animation'; id: string; name: string }
  | { type: 'shot'; id: string; name: string }
  | { type: 'environment'; id: string; name: string };

export function setDragData(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(ITW_DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', payload.name);
  event.dataTransfer.effectAllowed = 'copy';
}

export function readDragData(event: DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData(ITW_DRAG_TYPE);
    if (!raw) return null;
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

export interface PanelLayout {
  left: number;
  right: number;
  bottom: number;
  storyboard: number;
}

export const DEFAULT_LAYOUT: PanelLayout = {
  left: 278,
  right: 314,
  bottom: 366,
  storyboard: 146,
};

const STORAGE_KEY = 'itw.editorLayout.v1';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function clampLayout(
  input: PanelLayout,
  viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth,
  viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight,
): PanelLayout {
  let left = clamp(Math.round(input.left), 180, 560);
  let right = clamp(Math.round(input.right), 220, 640);
  const maxSides = Math.max(360, viewportWidth - 320);
  if (left + right > maxSides) {
    const scale = maxSides / (left + right);
    left = Math.max(160, Math.round(left * scale));
    right = Math.max(200, Math.round(right * scale));
  }
  const maxBottom = Math.max(200, Math.min(viewportHeight - 200, Math.round(viewportHeight * 0.78)));
  const bottom = clamp(Math.round(input.bottom), 160, maxBottom);
  const storyboard = clamp(Math.round(input.storyboard), 90, Math.max(90, bottom - 140));
  return { left, right, bottom, storyboard };
}

export function loadLayout(): PanelLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clampLayout(DEFAULT_LAYOUT);
    const parsed = JSON.parse(raw) as Partial<PanelLayout>;
    return clampLayout({
      left: typeof parsed.left === 'number' ? parsed.left : DEFAULT_LAYOUT.left,
      right: typeof parsed.right === 'number' ? parsed.right : DEFAULT_LAYOUT.right,
      bottom: typeof parsed.bottom === 'number' ? parsed.bottom : DEFAULT_LAYOUT.bottom,
      storyboard: typeof parsed.storyboard === 'number' ? parsed.storyboard : DEFAULT_LAYOUT.storyboard,
    });
  } catch {
    return clampLayout(DEFAULT_LAYOUT);
  }
}

export function saveLayout(layout: PanelLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage unavailable; layout simply resets next launch.
  }
}

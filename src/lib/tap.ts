export interface Tap {
  key: string;
  x: number;
  y: number;
  at: number;
  scrollTop: number;
  scrollLeft: number;
}
export function isDoubleTap(previous: Tap | null, next: Tap) {
  return (
    !!previous &&
    previous.key === next.key &&
    next.at - previous.at >= 0 &&
    next.at - previous.at <= 450 &&
    Math.hypot(next.x - previous.x, next.y - previous.y) <= 24 &&
    Math.abs(next.scrollTop - previous.scrollTop) < 3 &&
    Math.abs(next.scrollLeft - previous.scrollLeft) < 3
  );
}

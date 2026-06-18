import { describe, expect, it } from 'vitest';
import {
  DRAWING_A4_HEIGHT,
  DRAWING_A4_RATIO,
  DRAWING_A4_WIDTH,
  emptyDrawing,
  normalizeDrawingData,
} from './note-types';

describe('drawing A4 format', () => {
  it('empty drawing uses A4 dimensions', () => {
    const drawing = emptyDrawing();
    expect(drawing.width).toBe(DRAWING_A4_WIDTH);
    expect(drawing.height).toBe(DRAWING_A4_HEIGHT);
    expect(drawing.width / drawing.height).toBeCloseTo(DRAWING_A4_RATIO, 5);
  });

  it('normalizes legacy canvas size onto A4 without distortion', () => {
    const legacy = {
      version: 1 as const,
      width: 1200,
      height: 800,
      strokes: [
        {
          color: '#fff',
          width: 4,
          points: [
            { x: 0, y: 0 },
            { x: 1200, y: 800 },
          ],
        },
      ],
    };

    const normalized = normalizeDrawingData(legacy);
    expect(normalized.width).toBe(DRAWING_A4_WIDTH);
    expect(normalized.height).toBe(DRAWING_A4_HEIGHT);

    const [start, end] = normalized.strokes[0].points;
    const scale = Math.min(DRAWING_A4_WIDTH / 1200, DRAWING_A4_HEIGHT / 800);
    const offsetX = (DRAWING_A4_WIDTH - 1200 * scale) / 2;
    const offsetY = (DRAWING_A4_HEIGHT - 800 * scale) / 2;

    expect(start.x).toBeCloseTo(offsetX, 5);
    expect(start.y).toBeCloseTo(offsetY, 5);
    expect(end.x).toBeCloseTo(1200 * scale + offsetX, 5);
    expect(end.y).toBeCloseTo(800 * scale + offsetY, 5);
  });
});

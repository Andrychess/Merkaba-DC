import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawingData, DrawStroke } from '@shared/note-types';
import { emptyDrawing, parseDrawingBody, serializeDrawingBody } from '@shared/note-types';

interface DrawingEditorProps {
  body: string;
  onChange: (body: string) => void;
}

const COLORS = ['#e8e8f0', '#d4677a', '#d9c56e', '#6eb5ff', '#7dcea0', '#ffffff'];
const WIDTHS = [2, 4, 8];

function redrawCanvas(canvas: HTMLCanvasElement, data: DrawingData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#1a1c2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const stroke of data.strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.eraser ? '#1a1c2e' : stroke.color;
    ctx.lineWidth = stroke.eraser ? stroke.width * 3 : stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }
}

export function DrawingEditor({ body, onChange }: DrawingEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DrawingData>(() => parseDrawingBody(body));
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [eraser, setEraser] = useState(false);
  const drawingRef = useRef(false);
  const currentStroke = useRef<DrawStroke | null>(null);
  const lastBody = useRef(body);

  const syncOut = useCallback(
    (next: DrawingData) => {
      setData(next);
      const serialized = serializeDrawingBody(next);
      lastBody.current = serialized;
      onChange(serialized);
    },
    [onChange]
  );

  useEffect(() => {
    if (body !== lastBody.current) {
      const parsed = parseDrawingBody(body);
      setData(parsed);
      lastBody.current = body;
      const canvas = canvasRef.current;
      if (canvas) redrawCanvas(canvas, parsed);
    }
  }, [body]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const w = Math.max(container.clientWidth, 400);
      const h = Math.max(container.clientHeight, 300);
      canvas.width = w;
      canvas.height = h;
      redrawCanvas(canvas, data);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [data]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getPoint(e);
    if (!point) return;
    drawingRef.current = true;
    currentStroke.current = {
      color: eraser ? '#1a1c2e' : color,
      width,
      eraser,
      points: [point],
    };
  };

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || !currentStroke.current) return;
    const point = getPoint(e);
    if (!point) return;
    currentStroke.current.points.push(point);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const stroke = currentStroke.current;
    const pts = stroke.points;
    if (ctx && pts.length >= 2) {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      ctx.beginPath();
      ctx.strokeStyle = stroke.eraser ? '#1a1c2e' : stroke.color;
      ctx.lineWidth = stroke.eraser ? stroke.width * 3 : stroke.width;
      ctx.lineCap = 'round';
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  };

  const endDraw = () => {
    if (!drawingRef.current || !currentStroke.current) return;
    drawingRef.current = false;
    const stroke = currentStroke.current;
    currentStroke.current = null;
    if (stroke.points.length < 2) return;
    syncOut({ ...data, strokes: [...data.strokes, stroke] });
  };

  const handleClear = () => {
    if (!confirm('Очистить весь рисунок?')) return;
    syncOut(emptyDrawing());
    const canvas = canvasRef.current;
    if (canvas) redrawCanvas(canvas, emptyDrawing());
  };

  const handleUndo = () => {
    if (data.strokes.length === 0) return;
    const next = { ...data, strokes: data.strokes.slice(0, -1) };
    syncOut(next);
    const canvas = canvasRef.current;
    if (canvas) redrawCanvas(canvas, next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-merkaba-border bg-merkaba-sidebar/30 shrink-0">
        <span className="text-xs text-merkaba-muted mr-1">Кисть</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { setColor(c); setEraser(false); }}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${
              !eraser && color === c ? 'border-merkaba-accent scale-110' : 'border-merkaba-border'
            }`}
            style={{ backgroundColor: c }}
            title="Цвет"
          />
        ))}

        <div className="w-px h-5 bg-merkaba-border mx-1" />

        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            className={`w-7 h-7 rounded-md flex items-center justify-center ${
              width === w ? 'bg-merkaba-accent-soft text-merkaba-accent' : 'hover:bg-merkaba-hover text-merkaba-muted'
            }`}
            title={`Толщина ${w}`}
          >
            <span
              className="rounded-full bg-current"
              style={{ width: w + 4, height: w + 4 }}
            />
          </button>
        ))}

        <div className="w-px h-5 bg-merkaba-border mx-1" />

        <button
          type="button"
          onClick={() => setEraser((v) => !v)}
          className={`btn-ghost !text-xs !py-1.5 ${eraser ? 'bg-merkaba-accent-soft text-merkaba-accent' : ''}`}
        >
          Ластик
        </button>
        <button type="button" onClick={handleUndo} className="btn-ghost !text-xs !py-1.5">
          Отменить
        </button>
        <button type="button" onClick={handleClear} className="btn-ghost !text-xs !py-1.5">
          Очистить
        </button>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden bg-merkaba-bg p-2">
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-xl border border-merkaba-border cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
      </div>
    </div>
  );
}

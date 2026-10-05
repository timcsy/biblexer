// 閱讀器根元件：相機狀態、層級切換、虛擬化（research R5）
// 版面（layout）與視窗無關；視窗大小只改變相機（原則 1）。放手一律吸附到著陸點（根公理）。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cameraForVerse, createContext, levelOf, refit, snap, step, zoomStep, type Camera, type CameraContext } from '../../reader/camera.ts';
import { layoutBook, type Line } from '../../reader/layout.ts';
import { WORLD, pageRect } from '../../reader/world.ts';
import type { BookData } from '../../worker/present.ts';
import { STRINGS } from '../strings.ts';
import { BookLayer } from './BookLayer.tsx';
import { CanonLayer } from './CanonLayer.tsx';
import { attachGestures } from './gestures.ts';
import { OutlineLayer } from './OutlineLayer.tsx';
import { ReadingLayer } from './ReadingLayer.tsx';
import { U } from './units.ts';

export interface ReaderProps {
  data: BookData;
  /** 開啟時的經節（相對於本書第一節）與命中範圍 */
  start?: { verseIdx: number; hit?: { from: number; to: number } };
  onBack: () => void;
}

const LEVEL_LABEL = { canon: STRINGS.levelCanon, book: STRINGS.levelBook, outline: STRINGS.levelOutline, reading: STRINGS.levelReading } as const;

export function Reader({ data, start, onBack }: ReaderProps) {
  const layout = useMemo(() => layoutBook({ book: data.book, verses: data.verses, paragraphStarts: data.paragraphStarts }), [data]);
  const linesByPage = useMemo(() => {
    const m = new Map<number, Line[]>();
    for (const l of layout.lines) (m.get(l.pos.page) ?? m.set(l.pos.page, []).get(l.pos.page)!).push(l);
    return m;
  }, [layout]);
  const verseStart = useMemo(() => new Map(layout.verses.map((v) => [v.verseIdx, `${v.start.page}:${v.start.column}:${v.start.line}:${v.start.cell}`])), [layout]);

  const stage = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<CameraContext | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const ctxRef = useRef<CameraContext | null>(null);
  const camRef = useRef<Camera | null>(null);
  ctxRef.current = ctx;
  camRef.current = camera;
  // 手勢事件可能在重新渲染前連續到達：同步更新 ref
  const set = (c: Camera) => {
    camRef.current = c;
    setCamera(c);
  };

  // 量測視窗；視窗改變時重新對準原本的著陸點（版面不動）
  useLayoutEffect(() => {
    const el = stage.current!;
    const measure = () => {
      const next = createContext(layout, { width: el.clientWidth, height: el.clientHeight });
      const prev = ctxRef.current;
      const cam = camRef.current;
      ctxRef.current = next;
      setCtx(next);
      set(cam && prev ? refit(cam, prev, next) : cameraForVerse(start?.verseIdx ?? 0, next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  // 鍵盤：PageDown/PageUp 翻框（欄或頁）、方向鍵到下一個著陸點、＋／− 縮放
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = camRef.current;
      const x = ctxRef.current;
      if (!c || !x) return;
      const map: Record<string, () => Camera> = {
        PageDown: () => step(c, x, 1, 'frame'),
        PageUp: () => step(c, x, -1, 'frame'),
        ArrowDown: () => step(c, x, 1, 'landing'),
        ArrowRight: () => step(c, x, 1, 'landing'),
        ArrowUp: () => step(c, x, -1, 'landing'),
        ArrowLeft: () => step(c, x, -1, 'landing'),
        '+': () => zoomStep(c, x, 1),
        '=': () => zoomStep(c, x, 1),
        '-': () => zoomStep(c, x, -1),
      };
      const f = map[e.key];
      if (!f) return;
      e.preventDefault();
      set(f());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => attachGestures(stage.current!, { camera: () => camRef.current, ctx: () => ctxRef.current, set }), []);

  /** 正典層點羅馬書：回到 focus，沒有就到書首 */
  const enterBook = () => {
    const c = camRef.current;
    const x = ctxRef.current;
    if (!c || !x) return;
    set(c.focus ? snap({ ...c, scale: x.readingScale }, x) : cameraForVerse(0, x));
  };

  const level = ctx && camera ? levelOf(camera.scale, ctx.readingScale) : 'reading';
  const hit = start?.hit ?? null;

  let clipH: number | undefined;
  const pages: number[] = [];
  let px = 1;
  if (ctx && camera) {
    const sc = camera.scale;
    const vw = ctx.viewport.width / sc;
    const vh = ctx.viewport.height / sc;
    px = U / sc;
    // 視窗附近的頁（前後各多一頁）
    for (let p = 0; p < layout.pageCount; p++) {
      const r = pageRect(layout, p);
      if (r.x + r.w >= camera.x - WORLD.pageWidth && r.x <= camera.x + vw + WORLD.pageWidth && r.y + r.h >= camera.y - WORLD.pageHeight && r.y <= camera.y + vh + WORLD.pageHeight) pages.push(p);
    }
    if (level === 'reading') {
      // 精讀層：可見高度取整數行、最多一整欄，不切行（FR-011）
      const lh = WORLD.lineHeight * sc;
      clipH = Math.min(Math.floor(ctx.viewport.height / lh), layout.params.linesPerColumn) * lh;
    }
  }
  // 縮放、平移期間只改 transform；層的內容只在頁或層級改變時重畫（標籤字級除外）
  const pagesKey = pages.join(',');
  const pxKey = level === 'reading' ? 0 : Math.round(px * 100) / 100;
  const body = useMemo(() => {
    if (!ctx || !camera) return null;
    if (level === 'reading') return <ReadingLayer layout={layout} data={data} pages={pages} linesByPage={linesByPage} verseStart={verseStart} hit={hit} />;
    if (level === 'outline') return <OutlineLayer layout={layout} data={data} pages={pages} linesByPage={linesByPage} px={pxKey} />;
    if (level === 'book') return <BookLayer layout={layout} pages={pages} linesByPage={linesByPage} px={pxKey} />;
    return <CanonLayer layout={layout} px={pxKey} onEnter={enterBook} />;
  }, [level, pagesKey, pxKey, layout, !ctx || !camera]);

  const transform = camera ? `translate(${-camera.x * camera.scale}px, ${-camera.y * camera.scale}px) scale(${camera.scale / U})` : undefined;

  return (
    <section class="reader" data-testid="reader" data-level={level} data-focus={camera?.focus ?? ''} data-landing={camera?.at ?? ''}>
      <header class="reader-bar">
        <button type="button" class="link" data-testid="reader-back" onClick={onBack}>
          {STRINGS.readerBack}
        </button>
        <h2>羅馬書</h2>
        <span class="reader-level" data-testid="reader-level">
          {LEVEL_LABEL[level]}
        </span>
        <span class="reader-zoom">
          <button type="button" data-testid="zoom-out" aria-label={STRINGS.zoomOut} onClick={() => ctx && camera && setCamera(zoomStep(camera, ctx, -1))}>
            −
          </button>
          <button type="button" data-testid="zoom-in" aria-label={STRINGS.zoomIn} onClick={() => ctx && camera && setCamera(zoomStep(camera, ctx, 1))}>
            ＋
          </button>
        </span>
      </header>
      <div class="reader-stage" ref={stage}>
        <div class="reader-viewport" data-testid="reader-viewport" style={clipH !== undefined ? { height: `${clipH}px` } : { height: '100%' }}>
          <div class="world" style={transform ? { transform } : {}}>
            {body}
          </div>
        </div>
      </div>
      <p class="reader-attr" data-testid="segmentation-attribution">
        {STRINGS.segmentationAttribution}
      </p>
    </section>
  );
}

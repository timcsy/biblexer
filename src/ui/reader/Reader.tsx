// 閱讀器根元件：相機狀態、層級切換、虛擬化（research R5）
// 版面（layout）與視窗無關；視窗大小只改變相機（原則 1）。放手一律吸附到著陸點（根公理）。
//
// 試讀後的修訂（research R3a～R8；討論見 knowledge/draft/2026-10-05-閱讀順序與平面的接縫.md）：
// - 版面可切換「長卷」（精讀、段落輪廓時所有頁排成一列，書卷、正典層才折成每列 6 頁）與「每列六頁」
// - 離散的移動（按鍵、按鈕、放手吸附）以過場動畫著陸（van Wijk & Nuij）；手勢開始即中斷；減少動態效果時不播放
// - 進度提示：第幾章、第幾頁
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cameraForVerse, createContext, flyPath, landingPoints, levelOf, refit, remap, scrubTarget, snap, step, tapTarget, zoomStep, type Camera, type CameraContext, type ZoomLevel, placeAt } from '../../reader/camera.ts';
import { layoutBook, type Layout, type Line } from '../../reader/layout.ts';
import { WORLD, arrange, pageRect, type Arrangement } from '../../reader/world.ts';
import type { BookData, ChapterView, ParallelsView } from '../../worker/present.ts';
import { ParallelsPanel } from './ParallelsPanel.tsx';
import { HyperbolicCanon } from './HyperbolicCanon.tsx';
import { bookById } from '../../core/canon.ts';
import { STRINGS } from '../strings.ts';
import { BookLayer } from './BookLayer.tsx';
import { CanonLayer } from './CanonLayer.tsx';
import { attachGestures } from './gestures.ts';
import { LineBars, OutlineLayer } from './OutlineLayer.tsx';
import { PageSheets, ReadingLayer, RowSheets } from './ReadingLayer.tsx';
import { U } from './units.ts';

export interface ReaderProps {
  data: BookData;
  /** 開啟時的經節（相對於本書第一節）與命中範圍 */
  start?: { verseIdx: number; hit?: { from: number; to: number } };
  onBack: () => void;
  /** 正典層點其他書卷：開啟那一卷（spec 005） */
  onOpenBook?: (book: number, chapter?: number) => void;
  /** 串珠（spec 004）：由主頁透過 Worker 取得 */
  loadParallels?: (verseIdx: number) => Promise<ParallelsView>;
  loadChapter?: (book: number, chapter: number) => Promise<ChapterView>;
  /** 加入經文卡（spec 003 US3）：目前段落 */
  onAddToCard?: (item: { start: [number, number, number]; end: [number, number, number] }) => void;
}

const LEVEL_LABEL = { canon: STRINGS.levelCanon, book: STRINGS.levelBook, outline: STRINGS.levelOutline, reading: STRINGS.levelReading } as const;
const ARRANGEMENT_KEY = 'biblexer.reader.arrangement';
const CANON_STYLE_KEY = 'biblexer.reader.canonStyle';
/** 正典層（原型）：方塊或雙曲全貌 */
type CanonStyle = 'tiles' | 'hyperbolic';
const loadCanonStyle = (): CanonStyle => {
  try {
    return localStorage.getItem(CANON_STYLE_KEY) === 'tiles' ? 'tiles' : 'hyperbolic';
  } catch {
    return 'hyperbolic';
  }
};
const BOOK_STYLE_KEY = 'biblexer.reader.bookStyle';
/** 書卷層的全貌：章節地圖（一章一列、章號對齊左側）或頁面網格（每列六頁、章號對齊每列左側） */
type BookStyle = 'map' | 'grid';
const loadBookStyle = (): BookStyle => {
  try {
    return localStorage.getItem(BOOK_STYLE_KEY) === 'grid' ? 'grid' : 'map';
  } catch {
    return 'map';
  }
};
type Mode = 'strip' | 'grid';

const loadArrangement = (): Mode => {
  try {
    return localStorage.getItem(ARRANGEMENT_KEY) === 'grid' ? 'grid' : 'strip';
  } catch {
    return 'strip';
  }
};
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 長卷模式：精讀、段落輪廓用長卷；書卷、正典層折成每列 6 頁 */
const arrangementFor = (mode: Mode, style: BookStyle, level: ZoomLevel): Arrangement =>
  level === 'reading' || level === 'outline' ? mode : level === 'book' && style === 'map' ? 'chapters' : 'grid';

export function Reader({ data, start, onBack, onOpenBook, onAddToCard, loadParallels, loadChapter }: ReaderProps) {
  const [parallelsOpen, setParallelsOpen] = useState(false);
  const [canonStyle, setCanonStyle] = useState<CanonStyle>(loadCanonStyle);
  const toggleCanonStyle = () => {
    const next: CanonStyle = canonStyle === 'tiles' ? 'hyperbolic' : 'tiles';
    try {
      localStorage.setItem(CANON_STYLE_KEY, next);
    } catch {
      /* 不能存就只在這次有效 */
    }
    setCanonStyle(next);
  };
  const base = useMemo(() => layoutBook({ book: data.book, verses: data.verses, paragraphStarts: data.paragraphStarts }), [data]);
  const layouts = useMemo(() => ({ strip: arrange(base, 'strip'), grid: arrange(base, 'grid'), chapters: arrange(base, 'chapters') }), [base]);
  const linesByPage = useMemo(() => {
    const m = new Map<number, Line[]>();
    for (const l of base.lines) (m.get(l.pos.page) ?? m.set(l.pos.page, []).get(l.pos.page)!).push(l);
    return m;
  }, [base]);
  const verseStart = useMemo(() => new Map(base.verses.map((v) => [v.verseIdx, `${v.start.page}:${v.start.column}:${v.start.line}:${v.start.cell}`])), [base]);

  const stage = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>(loadArrangement);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [bookStyle, setBookStyle] = useState<BookStyle>(loadBookStyle);
  const styleRef = useRef(bookStyle);
  styleRef.current = bookStyle;
  const ctxsRef = useRef<Record<Arrangement, CameraContext> | null>(null);
  const [ctx, setCtx] = useState<CameraContext | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const ctxRef = useRef<CameraContext | null>(null);
  const camRef = useRef<Camera | null>(null);
  const anim = useRef<number | null>(null);

  const useCtx = (x: CameraContext) => {
    ctxRef.current = x;
    setCtx(x);
  };
  /** 依相機的層級選排列；排列改變時換算相機，讓中心所在的頁不動 */
  const settleArrangement = (c: Camera): Camera => {
    const from = ctxRef.current;
    const all = ctxsRef.current;
    if (!from || !all) return c;
    const to = all[arrangementFor(modeRef.current, styleRef.current, levelOf(c.scale, from.readingScale))];
    if (to === from) return c;
    useCtx(to);
    return remap(c, from, to);
  };
  const show = (c: Camera) => {
    camRef.current = c;
    setCamera(c);
  };
  /** 立即更新（手勢中、初始） */
  const set = (c: Camera) => show(settleArrangement(c));
  const interrupt = () => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };
  /** 以過場動畫著陸；目標在目前的 ctx 中計算 */
  const land = (target: Camera) => {
    interrupt();
    const cur = camRef.current;
    const from = ctxRef.current;
    if (!cur || !from) return show(target);
    const to = settleArrangement(target);
    const x = ctxRef.current!;
    const start = x === from ? cur : remap(cur, from, x);
    if (reducedMotion()) return show(to);
    const path = flyPath(start, to, x);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / path.duration);
      // 緩入緩出
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      show(path.at(t >= 1 ? 1 : e));
      anim.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    anim.current = requestAnimationFrame(tick);
  };

  // 量測視窗；視窗改變時重新對準原本的著陸點（版面不動）
  useLayoutEffect(() => {
    const el = stage.current!;
    const measure = () => {
      interrupt();
      const vp = { width: el.clientWidth, height: el.clientHeight };
      const next = { strip: createContext(layouts.strip, vp), grid: createContext(layouts.grid, vp), chapters: createContext(layouts.chapters, vp) };
      const prev = ctxRef.current;
      const cam = camRef.current;
      ctxsRef.current = next;
      if (cam && prev) {
        const same = next[prev.layout === layouts.strip ? 'strip' : prev.layout === layouts.chapters ? 'chapters' : 'grid'];
        useCtx(same);
        set(refit(cam, prev, same));
      } else {
        const first = next[arrangementFor(modeRef.current, styleRef.current, 'reading')];
        useCtx(first);
        set(cameraForVerse(start?.verseIdx ?? 0, first));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layouts]);

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
      // 動畫進行中再按：以目標為起點，連按時不會落後
      land(f());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** 縮小後點一下：以點到的那一行所在段落進入精讀 */
  const tap = (pt: { x: number; y: number }) => {
    const c = camRef.current;
    const x = ctxRef.current;
    if (!c || !x) return;
    const t = tapTarget(c, pt, x);
    if (t) land(t);
  };
  useEffect(() => attachGestures(stage.current!, { camera: () => camRef.current, ctx: () => ctxRef.current, set, land, interrupt, tap }), []);

  // 拖動進度條：按比例翻到某一頁（接近章刻度時吸到該章開頭），畫面即時跟著翻；放手即停在那裡
  const [scrub, setScrub] = useState<{ chapter: number; page: number } | null>(null);
  const scrubTo = (el: HTMLElement, clientX: number) => {
    const all = ctxsRef.current;
    if (!all) return;
    const r = el.getBoundingClientRect();
    const read = all[arrangementFor(modeRef.current, styleRef.current, 'reading')];
    const t = scrubTarget((clientX - r.left) / r.width, read);
    if (ctxRef.current !== read) useCtx(read);
    interrupt();
    show(t.camera);
    setScrub({ chapter: t.chapter, page: t.page });
  };
  const onScrubDown = (e: PointerEvent) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    scrubTo(el, e.clientX);
  };
  const onScrubMove = (e: PointerEvent) => {
    if (!scrub) return;
    e.stopPropagation();
    scrubTo(e.currentTarget as HTMLElement, e.clientX);
  };
  const onScrubUp = (e: PointerEvent) => {
    e.stopPropagation();
    setScrub(null);
  };
  useEffect(() => interrupt, []);

  /** 正典層點書卷：目前這一卷回到 focus（沒有就到書首）；其他卷開啟那一卷（spec 005） */
  const enterTile = (book: number) => {
    if (book !== data.book) onOpenBook?.(book);
    else enterBook();
  };
  const enterBook = () => {
    const c = camRef.current;
    const x = ctxRef.current;
    if (!c || !x) return;
    land(c.focus ? snap({ ...c, scale: x.readingScale }, x) : cameraForVerse(0, x));
  };

  /** 書卷層點章號：飛到那一章的開頭（精讀） */
  const enterChapter = (chapter: number) => {
    const all = ctxsRef.current;
    if (!all) return;
    const v = data.verses.findIndex((x) => x.ref.chapter === chapter && !x.merged);
    if (v >= 0) land(cameraForVerse(v, all[arrangementFor(modeRef.current, styleRef.current, 'reading')]));
  };

  /** 目前段落（有段落標示時以它為準，否則以著陸點的第一節所在段落） */
  const addCurrentParagraph = () => {
    const c = camRef.current;
    const x = ctxRef.current;
    if (!c || !x || !onAddToCard) return;
    const lp = c.at ? landingPoints(x.layout, levelOf(c.scale, x.readingScale)).find((p) => p.id === c.at) : undefined;
    const v = c.at?.startsWith('para:') ? Number(c.at.slice(5)) : (lp?.verseIdx ?? 0);
    const starts = data.paragraphStarts;
    const k = starts.filter((s) => s <= v).length - 1;
    const from = starts[k] ?? 0;
    const to = (starts[k + 1] ?? data.verses.length) - 1;
    const key = (i: number): [number, number, number] => [data.verses[i]!.ref.book, data.verses[i]!.ref.chapter, data.verses[i]!.ref.verse];
    onAddToCard({ start: key(from), end: key(to) });
  };

  const toggleBookStyle = () => {
    const next: BookStyle = bookStyle === 'map' ? 'grid' : 'map';
    try {
      localStorage.setItem(BOOK_STYLE_KEY, next);
    } catch {
      /* 不能存就只在這次有效 */
    }
    styleRef.current = next;
    setBookStyle(next);
    const c = camRef.current;
    if (c) show(settleArrangement(c));
  };

  const toggleMode = () => {
    const next: Mode = mode === 'strip' ? 'grid' : 'strip';
    try {
      localStorage.setItem(ARRANGEMENT_KEY, next);
    } catch {
      /* 不能存就只在這次有效 */
    }
    modeRef.current = next;
    setMode(next);
    const c = camRef.current;
    if (c) show(settleArrangement(c));
  };

  const layout: Layout = ctx?.layout ?? layouts.grid;
  const level = ctx && camera ? levelOf(camera.scale, ctx.readingScale) : 'reading';
  const hit = start?.hit ?? null;

  let clipH: number | undefined;
  const pages: number[] = [];
  let px = 1;
  let centerPage = 0;
  if (ctx && camera) {
    const sc = camera.scale;
    const vw = ctx.viewport.width / sc;
    const vh = ctx.viewport.height / sc;
    px = U / sc;
    const cx = camera.x + vw / 2;
    const cy = camera.y + vh / 2;
    let best = Infinity;
    // 視窗附近的頁（前後各多一頁）；章節地圖不分頁，全部畫出
    for (let p = 0; p < layout.pageCount; p++) {
      if (layout.lineRects) {
        pages.push(p);
        continue;
      }
      const r = pageRect(layout, p);
      if (r.x + r.w >= camera.x - WORLD.pageWidth && r.x <= camera.x + vw + WORLD.pageWidth && r.y + r.h >= camera.y - WORLD.pageHeight && r.y <= camera.y + vh + WORLD.pageHeight) pages.push(p);
      const d = Math.hypot(Math.max(r.x - cx, 0, cx - r.x - r.w), Math.max(r.y - cy, 0, cy - r.y - r.h));
      if (d < best) {
        best = d;
        centerPage = p;
      }
    }
    if (level === 'reading') {
      // 精讀層：可見高度取整數行、最多一整欄，不切行（FR-011）
      const lh = WORLD.lineHeight * sc;
      clipH = Math.min(Math.floor(ctx.viewport.height / lh), layout.params.linesPerColumn) * lh;
    }
  }

  // 進度：停在著陸點時以它所在的行為準，否則以視窗中心所在的頁
  const progress = useMemo(() => {
    if (!ctx || !camera || level === 'canon') return null;
    const lp = camera.at ? landingPoints(layout, level).find((p) => p.id === camera.at) : undefined;
    const line = lp?.line ?? linesByPage.get(centerPage)?.[0]?.index ?? 0;
    const page = base.lines[line]?.pos.page ?? centerPage;
    const chapter = base.chapters.filter((c) => c.line <= line).at(-1)?.chapter ?? 1;
    return { chapter, page: page + 1, pages: base.pageCount, fraction: line / base.lines.length };
  }, [camera?.at, centerPage, level, layout]);

  const nChapters = base.chapters.length;
  const labelStep = nChapters <= 24 ? 1 : nChapters <= 60 ? 5 : nChapters <= 120 ? 10 : 20;
  const lastProgress = useRef(progress);
  if (progress) lastProgress.current = progress;
  const pr = progress ?? lastProgress.current;

  // 串珠的來源：目前段落（有段落標示時以它為準，否則以著陸點的第一節）
  const currentSource = useMemo(() => {
    if (!ctx || !camera?.at) return null;
    const lp = landingPoints(ctx.layout, levelOf(camera.scale, ctx.readingScale)).find((p) => p.id === camera.at);
    const v = camera.at.startsWith('para:') ? Number(camera.at.slice(5)) : (lp?.verseIdx ?? null);
    return v === null ? null : { id: camera.at, verseIdx: v };
  }, [camera?.at, ctx]);

  // 目前停的段落：畫面停在框頂端，段落以左側標示線呈現（FR-011a）
  const markLines = useMemo(() => {
    if ((level !== 'reading' && level !== 'outline') || !camera?.at?.startsWith('para:')) return undefined;
    const v = Number(camera.at.slice(5));
    const k = base.paragraphs.findIndex((p) => p.verseIdx === v);
    if (k < 0) return undefined;
    const end = base.paragraphs[k + 1]?.line ?? base.lines.length;
    const set = new Set<number>();
    for (let i = base.paragraphs[k]!.line; i < end; i++) if (!base.lines[i]!.chapterStart) set.add(i);
    return set;
  }, [level, camera?.at, base]);

  // 縮放、平移期間只改 transform；層的內容只在頁或層級改變時重畫（標籤字級除外）
  const pagesKey = pages.join(',');
  const pxKey = level === 'reading' ? 0 : Math.round(px * 100) / 100;
  const paper = level === 'outline' || level === 'book';
  const body = useMemo(() => {
    if (!ctx || !camera) return null;
    if (level === 'reading') return <ReadingLayer layout={layout} data={data} pages={pages} linesByPage={linesByPage} verseStart={verseStart} hit={hit} {...(markLines ? { markLines } : {})} />;
    if (level === 'outline') return <OutlineLayer layout={layout} data={data} pages={pages} px={pxKey} {...(camera.at?.startsWith('para:') ? { current: Number(camera.at.slice(5)) } : {})} {...(markLines ? { markLines } : {})} />;
    if (level === 'book') return <BookLayer layout={layout} pages={pages} px={pxKey} aligned={!layout.lineRects} onChapter={enterChapter} {...(progress ? { current: progress.chapter } : {})} />;
    if (canonStyle === 'hyperbolic') return null;
    return <CanonLayer layout={layout} px={pxKey} onEnter={enterTile} />;
  }, [canonStyle, level, pagesKey, pxKey, layout, !ctx || !camera, progress?.chapter, markLines]);
  // 段落輪廓與書卷層共用的頁面底色與行長條：元素在兩層之間保留，排列切換時以 CSS 動畫折疊
  const paperBody = useMemo(
    () =>
      paper
        ? [
            layout.rows ? <RowSheets key="rows" layout={layout} /> : <PageSheets key="sheets" layout={layout} pages={pages} />,
            <LineBars key="bars" layout={layout} lines={pages.flatMap((p) => linesByPage.get(p) ?? []).filter((l) => !(layout.lineRects && l.chapterStart))} />,
          ]
        : null,
    [paper, pagesKey, layout],
  );

  const transform = camera ? `translate(${-camera.x * camera.scale}px, ${-camera.y * camera.scale}px) scale(${camera.scale / U})` : undefined;

  return (
    <section class="reader" data-testid="reader" data-level={level} data-focus={camera?.focus ?? ''} data-landing={camera?.at ?? ''} data-arrangement={mode} data-book-style={bookStyle} data-canon-style={canonStyle}>
      <header class="reader-bar">
        <button type="button" class="link" data-testid="reader-back" onClick={onBack}>
          {STRINGS.readerBack}
        </button>
        <h2 data-testid="reader-title">{bookById(data.book)?.name}</h2>
        <span class="reader-level" data-testid="reader-level">
          {LEVEL_LABEL[level]}
        </span>
        <button type="button" class="reader-arrangement" data-testid="arrangement-toggle" aria-pressed={mode === 'strip'} title={STRINGS.arrangementLabel} onClick={toggleMode}>
          {STRINGS.arrangementLabel}：{mode === 'strip' ? STRINGS.arrangementStrip : STRINGS.arrangementGrid}
        </button>
        <button type="button" class="reader-arrangement" data-testid="bookstyle-toggle" aria-pressed={bookStyle === 'map'} onClick={toggleBookStyle}>
          {STRINGS.bookStyleLabel}：{bookStyle === 'map' ? STRINGS.bookStyleMap : STRINGS.bookStyleGrid}
        </button>
        {loadParallels && (
          <button type="button" class="reader-arrangement" data-testid="reader-parallels" aria-pressed={parallelsOpen} onClick={() => setParallelsOpen(!parallelsOpen)}>
            {STRINGS.parallels}
          </button>
        )}
        {onAddToCard && (
          <button type="button" class="reader-arrangement" data-testid="reader-add-to-card" onClick={addCurrentParagraph}>
            {STRINGS.addToCard}
          </button>
        )}
        {level === 'canon' && (
          <button type="button" class="reader-arrangement" data-testid="canonstyle-toggle" aria-pressed={canonStyle === 'hyperbolic'} onClick={toggleCanonStyle}>
            {STRINGS.canonStyleLabel}：{canonStyle === 'hyperbolic' ? STRINGS.canonStyleHyperbolic : STRINGS.canonStyleTiles}
          </button>
        )}
        <span class="reader-zoom">
          <button type="button" data-testid="zoom-out" aria-label={STRINGS.zoomOut} onClick={() => ctx && camera && land(zoomStep(camera.at ? camera : snap(camera, ctx), ctx, -1))}>
            −
          </button>
          <button type="button" data-testid="zoom-in" aria-label={STRINGS.zoomIn} onClick={() => ctx && camera && land(zoomStep(camera.at ? camera : snap(camera, ctx), ctx, 1))}>
            ＋
          </button>
        </span>
      </header>
      <div class="reader-stage" ref={stage}>
        <div class="reader-viewport" data-testid="reader-viewport" style={clipH !== undefined ? { height: `${clipH}px` } : { height: '100%' }}>
          <div class="world fold" style={transform ? { transform } : {}}>
            {paperBody}
            {body}
          </div>
        </div>
        {level === 'canon' && canonStyle === 'hyperbolic' && ctx && camera && (
          <HyperbolicCanon
            focusBook={camera.at?.startsWith('book:') ? Number(camera.at.slice(5)) : data.book}
            width={ctx.viewport.width}
            height={ctx.viewport.height}
            onFocus={(b) => {
              const lp = landingPoints(ctx.layout, 'canon').find((p) => p.id === `book:${b}`);
              if (lp) land(placeAt(lp, ctx));
            }}
            onEnter={(b, ch) => {
              if (b === data.book) enterChapter(ch);
              else onOpenBook?.(b, ch);
            }}
          />
        )}
      </div>
      {/* 一律占位：在正典層只是看不見，避免閱讀區高度改變而觸發重新量測 */}
      {pr && (
        <div class="reader-scrub" style={progress ? {} : { visibility: 'hidden' }}>
          <span class={scrub ? 'scrub-label active' : 'scrub-label'} data-testid="reader-progress" aria-live="polite">
            {STRINGS.progress(scrub?.chapter ?? pr.chapter, scrub?.page ?? pr.page, pr.pages)}
          </span>
          <div class="scrub-track" data-testid="reader-scrub" role="slider" aria-label={STRINGS.scrubLabel} aria-valuemin={1} aria-valuemax={pr.pages} aria-valuenow={scrub?.page ?? pr.page} onPointerDown={onScrubDown} onPointerMove={onScrubMove} onPointerUp={onScrubUp} onPointerCancel={onScrubUp}>
            <span class="scrub-rail" />
            {base.chapters.map((c) => (
              <span key={c.chapter} class="scrub-tick" data-testid="scrub-tick" data-chapter={c.chapter} style={{ left: `${(c.line / base.lines.length) * 100}%` }}>
                {/* 章多時章號稀疏顯示（刻度全部保留），標籤不互相重疊（spec 005 FR-005） */}
                {(c.chapter === 1 || c.chapter % labelStep === 0) && <small>{c.chapter}</small>}
              </span>
            ))}
            <span class="scrub-thumb" data-testid="scrub-thumb" style={{ left: `${pr.fraction * 100}%` }} />
          </div>
        </div>
      )}
      {parallelsOpen && loadParallels && loadChapter && currentSource && <ParallelsPanel source={currentSource} load={loadParallels} loadChapter={loadChapter} onClose={() => setParallelsOpen(false)} />}
      {/* 署名放在同一行：層級切換時閱讀區高度不變（避免重新量測、畫面跳動） */}
      <p class="reader-attr">
        <span data-testid="segmentation-attribution">{STRINGS.segmentationAttribution}</span>
        {level === 'canon' && <span data-testid="canon-order-attribution">{`；${STRINGS.canonOrder}`}</span>}
      </p>
    </section>
  );
}

// 守護：data-model「相機」性質（根公理：連續地探索，離散地著陸；FR-009、FR-010、FR-012）
import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';
import { MAX_SCALE, MIN_SCALE, createContext, landingPoints, levelOf, panBy, placeAt, snap, zoomAt, type Camera, type CameraContext } from '../../src/reader/camera.ts';
import { layoutBook } from '../../src/reader/layout.ts';
import { gridRect } from '../../src/reader/world.ts';
import { sampleBook } from '../unit/reader-fixture.ts';

const layout = layoutBook(sampleBook());
const grid = gridRect(layout);

const ctxArb = fc
  .oneof(fc.constant({ width: 390, height: 744 }), fc.constant({ width: 820, height: 1080 }), fc.constant({ width: 1440, height: 800 }), fc.record({ width: fc.integer({ min: 320, max: 2400 }), height: fc.integer({ min: 420, max: 1400 }) }))
  .map((vp) => createContext(layout, vp));

const cameraArb = (ctx: CameraContext) =>
  fc.record({
    x: fc.double({ min: -2 * grid.w, max: 2 * grid.w, noNaN: true }),
    y: fc.double({ min: -2 * grid.h, max: 2 * grid.h, noNaN: true }),
    scale: fc.double({ min: MIN_SCALE * ctx.readingScale, max: MAX_SCALE * ctx.readingScale, noNaN: true }),
  });
const withCamera = ctxArb.chain((ctx) => fc.tuple(fc.constant(ctx), cameraArb(ctx)));

const screenPoint = (ctx: CameraContext) => fc.record({ x: fc.double({ min: 0, max: ctx.viewport.width, noNaN: true }), y: fc.double({ min: 0, max: ctx.viewport.height, noNaN: true }) });

test.prop([withCamera])('snap(snap(c)) = snap(c)（冪等）', ([ctx, c]) => {
  const once = snap(c, ctx);
  expect(snap(once, ctx)).toEqual(once);
});

test.prop([withCamera])('snap(c) 的位置屬於 landingPoints(levelOf(snap(c).scale))', ([ctx, c]) => {
  const s = snap(c, ctx);
  const level = levelOf(s.scale, ctx.readingScale);
  const lp = landingPoints(layout, level).find((p) => p.id === s.at);
  expect(lp).toBeDefined();
  const placed = placeAt(lp!, ctx);
  expect([s.x, s.y, s.scale]).toEqual([placed.x, placed.y, placed.scale]);
});

const zoomPlan = ctxArb.chain((ctx) =>
  fc.tuple(
    fc.constant(ctx),
    fc.nat({ max: landingPoints(layout, 'reading').length - 1 }),
    fc.array(fc.tuple(fc.double({ min: 0.05, max: 1.2, noNaN: true }), screenPoint(ctx), fc.boolean()), { minLength: 1, maxLength: 8 }),
    screenPoint(ctx),
  ),
);

test.prop([zoomPlan])('從精讀著陸點 L 只縮放（不平移）到任一層級，再放大回精讀並吸附 → 回到 L', ([ctx, i, zooms, back]) => {
  const L = landingPoints(layout, 'reading')[i]!;
  const start = placeAt(L, ctx);
  let c: Camera = start;
  for (const [factor, anchor, release] of zooms) {
    c = zoomAt(c, factor, anchor, ctx);
    if (release) c = snap(c, ctx);
  }
  c = zoomAt(c, ctx.readingScale / c.scale, back, ctx);
  expect(snap(c, ctx)).toEqual(start);
});

test.prop([withCamera, fc.array(fc.double({ min: 0.001, max: 1000, noNaN: true }), { minLength: 1, maxLength: 10 })])('scale 被夾在 [最小, 最大] 之間', ([ctx, c], factors) => {
  let cur: Camera = c;
  for (const f of factors) {
    cur = zoomAt(cur, f, { x: ctx.viewport.width / 2, y: ctx.viewport.height / 2 }, ctx);
    expect(cur.scale).toBeGreaterThanOrEqual(MIN_SCALE * ctx.readingScale);
    expect(cur.scale).toBeLessThanOrEqual(MAX_SCALE * ctx.readingScale);
  }
});

test.prop([withCamera, fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: -500, max: 500, noNaN: true })])('panBy 清除 focus；zoomAt 保留 focus', ([ctx, c], dx, dy) => {
  const landed = snap({ ...c, scale: ctx.readingScale }, ctx);
  expect(landed.focus).toBeDefined();
  expect(panBy(landed, dx, dy, ctx).focus).toBeUndefined();
  expect(zoomAt(landed, 0.5, { x: 10, y: 10 }, ctx).focus).toBe(landed.focus);
});

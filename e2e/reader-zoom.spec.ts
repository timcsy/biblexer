// US2：連續縮放並吸附到結構點（SC-002、SC-003、FR-007～FR-014）
import { expect, test, type Page } from '@playwright/test';
import { openReader, waitReady } from './helpers.ts';

const level = (page: Page) => page.getByTestId('reader').getAttribute('data-level');

/** 所有和可見區域相交的行，都必須完整在可見區域內 */
async function expectNoCutLines(page: Page): Promise<void> {
  const vp = (await page.getByTestId('reader-viewport').boundingBox())!;
  const boxes = await page.getByTestId('line').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom })));
  const visible = boxes.filter((b) => b.bottom > vp.y + 0.5 && b.top < vp.y + vp.height - 0.5);
  expect(visible.length).toBeGreaterThan(0);
  for (const b of visible) {
    expect(b.top).toBeGreaterThanOrEqual(vp.y - 0.5);
    expect(b.bottom).toBeLessThanOrEqual(vp.y + vp.height + 0.5);
  }
}

test('縮小按鈕依序經過 精讀 → 段落輪廓 → 書卷 → 正典，到邊界停住；放大回精讀', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  const seen = [await level(page)];
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('zoom-out').click();
    seen.push(await level(page));
  }
  expect(seen).toEqual(['reading', 'outline', 'book', 'canon', 'canon']);
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-in').click();
  await expect(page.getByTestId('reader')).toHaveAttribute('data-level', 'reading');
});

test('從第 8 章的段落縮小到正典，再放大回精讀 → 回到原本的著陸點', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  // 書卷層：移到第 8 章，再放大回精讀
  await page.getByTestId('zoom-out').click();
  await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'book');
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  await expect(reader).toHaveAttribute('data-landing', 'chapter:45:8');
  await page.getByTestId('zoom-in').click();
  await page.getByTestId('zoom-in').click();
  await expect(reader).toHaveAttribute('data-level', 'reading');
  const focus = (await reader.getAttribute('data-focus'))!;
  expect(focus).toMatch(/^(para|coltop):/);
  await expect(reader.locator('[data-testid="verse"][data-ref^="45:8:"]').first()).toBeVisible();
  // 縮小到正典再放大回來
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  await expect(reader).toHaveAttribute('data-level', 'canon');
  await expect(reader).toHaveAttribute('data-focus', focus);
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-in').click();
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(reader).toHaveAttribute('data-focus', focus);
  await expect(reader).toHaveAttribute('data-landing', focus);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`精讀層不切行；拖曳放手後吸附到著陸點（${viewport.width}×${viewport.height}）`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await waitReady(page, false);
    await openReader(page);
    const reader = page.getByTestId('reader');
    await expectNoCutLines(page);
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await expectNoCutLines(page);
    const before = await reader.getAttribute('data-landing');
    // 拖曳約一框的寬度、加上不對齊行的垂直距離後放手
    const vp = (await page.getByTestId('reader-viewport').boundingBox())!;
    const cx = vp.x + vp.width / 2;
    const cy = vp.y + vp.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - vp.width * 0.8, cy - 37, { steps: 8 });
    await page.mouse.up();
    await expect(reader).toHaveAttribute('data-level', 'reading');
    const landing = (await reader.getAttribute('data-landing'))!;
    expect(landing).toMatch(/^(para:\d+|coltop:\d+:\d+)$/);
    expect(landing).not.toBe(before);
    await expect(reader).toHaveAttribute('data-focus', landing);
    await expectNoCutLines(page);
  });
}

test('滾輪往下捲動前進到下一個著陸點；按住 Ctrl 的滾輪才縮放', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page, false);
  await openReader(page);
  const reader = page.getByTestId('reader');
  const vp = (await page.getByTestId('reader-viewport').boundingBox())!;
  await page.mouse.move(vp.x + vp.width / 2, vp.y + vp.height / 2);
  const before = (await reader.getAttribute('data-landing'))!;
  await page.mouse.wheel(0, 120);
  // 捲動中 data-landing 會暫時是空的；等它吸附到一個著陸點
  await expect(reader).toHaveAttribute('data-landing', /^(para:\d+|coltop:\d+:\d+)$/);
  const next = (await reader.getAttribute('data-landing'))!;
  expect(next).not.toBe(before);
  await expect(reader).toHaveAttribute('data-level', 'reading');
  await expect(reader).toHaveAttribute('data-focus', next);
  await expectNoCutLines(page);
  // 往回捲回到原處
  await page.mouse.wheel(0, -120);
  await expect(reader).toHaveAttribute('data-landing', before);
  // 觸控板雙指捏合（Ctrl＋滾輪）縮放
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 120);
  await page.keyboard.up('Control');
  await expect(reader).not.toHaveAttribute('data-level', 'reading');
});

test('段落輪廓層只有段落範圍與經文開頭字句，沒有標題', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  await page.getByTestId('zoom-out').click();
  await expect(page.getByTestId('reader')).toHaveAttribute('data-level', 'outline');
  const paras = page.getByTestId('outline-para');
  expect(await paras.count()).toBeGreaterThan(0);
  for (const range of await paras.evaluateAll((els) => els.map((e) => e.getAttribute('data-range')))) expect(range).toMatch(/^\d+:\d+(–(\d+:)?\d+)?$/);
  const first = page.locator('[data-testid="outline-para"][data-range^="1:1–"]');
  await expect(first.getByTestId('outline-excerpt')).toHaveText(/^耶穌基督的僕人保羅/);
});

test('正典層：66 卷依正典順序；點羅馬書回到精讀（其他卷可進入，見 e2e/whole-bible.spec.ts）', async ({ page }) => {
  await waitReady(page, false);
  await openReader(page);
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-out').click();
  await expect(page.getByTestId('reader')).toHaveAttribute('data-level', 'canon');
  // 這裡測的是方塊檢視（雙曲全貌另見 e2e/hyperbolic.spec.ts）
  for (let i = 0; i < 4 && (await page.getByTestId('reader').getAttribute('data-canon-style')) !== 'tiles'; i++) await page.getByTestId('canonstyle-toggle').click();
  const tiles = page.getByTestId('canon-book');
  await expect(tiles).toHaveCount(66);
  expect(await tiles.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-book'))))).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
  await expect(page.locator('[data-testid="canon-book"][data-book="45"]')).toHaveAttribute('aria-current', 'location');
  await page.locator('[data-testid="canon-book"][data-book="45"]').click();
  await expect(page.getByTestId('reader')).toHaveAttribute('data-level', 'reading');
});

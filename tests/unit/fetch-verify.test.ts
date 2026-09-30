// 守護：contracts/data-artifacts.md「下載並核對雜湊」
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { USER_AGENT, fetchVerified } from '../../scripts/lib/fetch.ts';

const body = new TextEncoder().encode('和合本');
const sha256 = createHash('sha256').update(body).digest('hex');
const fakeFetch = () => vi.fn(async () => new Response(body, { status: 200 }));

describe('下載核對', () => {
  test('雜湊相符時寫入檔案，並帶自訂 User-Agent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bl-'));
    const f = fakeFetch();
    const dest = join(dir, 'a.bin');
    await fetchVerified({ url: 'https://example.org/a', dest, hash: { algo: 'sha256', value: sha256 }, fetchImpl: f });
    expect(readFileSync(dest)).toEqual(Buffer.from(body));
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get('user-agent')).toBe(USER_AGENT);
    expect(USER_AGENT).not.toMatch(/python-urllib/i);
  });

  test('雜湊不符時拋出錯誤，且不留下檔案', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bl-'));
    const dest = join(dir, 'a.bin');
    await expect(
      fetchVerified({ url: 'https://example.org/a', dest, hash: { algo: 'sha256', value: '0'.repeat(64) }, fetchImpl: fakeFetch() }),
    ).rejects.toThrow(/雜湊/);
    expect(existsSync(dest)).toBe(false);
  });

  test('快取中已有且雜湊正確時不重新下載', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bl-'));
    const dest = join(dir, 'a.bin');
    writeFileSync(dest, body);
    const f = fakeFetch();
    const r = await fetchVerified({ url: 'https://example.org/a', dest, hash: { algo: 'sha256', value: sha256 }, fetchImpl: f });
    expect(f).not.toHaveBeenCalled();
    expect(r.downloaded).toBe(false);
  });

  test('HTTP 錯誤時拋出錯誤', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bl-'));
    const f = vi.fn(async () => new Response('no', { status: 403 }));
    await expect(
      fetchVerified({ url: 'https://example.org/a', dest: join(dir, 'x'), hash: { algo: 'sha1', value: 'x' }, fetchImpl: f }),
    ).rejects.toThrow(/403/);
  });
});

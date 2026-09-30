// 下載並核對雜湊（contracts/data-artifacts.md）
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** 信望愛會擋 Python-urllib 的 UA（research R1），所以一律帶自己的 UA */
export const USER_AGENT = 'BibLexer-build/0.1 (+offline Bible search; build-time data fetch)';

export interface ExpectedHash {
  algo: 'sha1' | 'sha256' | 'git-blob-sha1';
  value: string;
}

export interface FetchVerifiedOptions {
  url: string;
  dest: string;
  hash: ExpectedHash;
  fetchImpl?: typeof fetch;
}

/** git-blob-sha1：Hugging Face 對非 LFS 小檔公布的 oid（git blob 物件雜湊） */
export const digest = (algo: ExpectedHash['algo'], data: Uint8Array): string =>
  algo === 'git-blob-sha1'
    ? createHash('sha1').update(`blob ${data.byteLength}\0`).update(data).digest('hex')
    : createHash(algo).update(data).digest('hex');

export async function fetchVerified(opts: FetchVerifiedOptions): Promise<{ downloaded: boolean }> {
  const { url, dest, hash } = opts;
  const doFetch = opts.fetchImpl ?? fetch;

  if (existsSync(dest) && digest(hash.algo, readFileSync(dest)) === hash.value) {
    return { downloaded: false };
  }

  const res = await doFetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`下載失敗 ${res.status}：${url}`);
  const data = new Uint8Array(await res.arrayBuffer());
  const actual = digest(hash.algo, data);
  if (actual !== hash.value) {
    throw new Error(`雜湊不符：${url}\n  預期 ${hash.algo} ${hash.value}\n  實際 ${actual}`);
  }
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  writeFileSync(tmp, data);
  renameSync(tmp, dest);
  return { downloaded: true };
}

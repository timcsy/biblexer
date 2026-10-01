// 查詢正規化（spec FR-005、research R6）：全形英數轉半形、去除前後空白；
// 含簡體字時才載入 opencc 轉換器，逐字轉為繁體（不做詞彙替換）。
import { SIMPLIFIED_CHARS } from './simplified-chars.ts';

const simplified = new Set(SIMPLIFIED_CHARS);

export const hasSimplified = (s: string): boolean => [...s].some((c) => simplified.has(c));

/** 全形英數與常見標點（！～）轉為半形；中文標點保留 */
const toHalfWidth = (s: string): string =>
  s.replace(/[\uFF01-\uFF5E]/g, (c) => {
    const h = String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    return /[0-9A-Za-z:\-~]/.test(h) ? h : c;
  });

export type ConverterLoader = () => Promise<(s: string) => string>;

export const loadToTraditional: ConverterLoader = async () => {
  const OpenCC = await import('opencc-js/cn2t');
  return OpenCC.Converter({ from: 'cn', to: 'tw' });
};

export async function normalizeQuery(raw: string, loader: ConverterLoader = loadToTraditional): Promise<string> {
  const s = toHalfWidth(raw).trim();
  return hasSimplified(s) ? (await loader())(s) : s;
}

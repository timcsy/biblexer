// 產生「簡體專用字」清單（opencc-js cn→tw 逐字轉換後會改變的字），
// 讓執行時不必先載入轉換器就能判斷查詢是否含簡體字（research R6）。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as OpenCC from 'opencc-js/cn2t';
import { ROOT } from './lib/paths.ts';

const convert = OpenCC.Converter({ from: 'cn', to: 'tw' });
let chars = '';
for (let cp = 0x3400; cp <= 0x9fff; cp++) {
  const c = String.fromCodePoint(cp);
  if (convert(c) !== c) chars += c;
}
writeFileSync(
  join(ROOT, 'src/core/simplified-chars.ts'),
  `// 由 scripts/gen-simplified-chars.ts 產生，請勿手動修改。來源：opencc-js（MIT AND Apache-2.0）cn→tw 逐字轉換。\nexport const SIMPLIFIED_CHARS = '${chars}';\n`,
);
console.log(`簡體專用字：${chars.length} 個`);

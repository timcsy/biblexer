// 繁→簡（只用於送進模型的文字；顯示一律維持繁體）。逐字轉換，不做詞彙替換。
export async function loadToSimplified(): Promise<(s: string) => string> {
  const OpenCC = await import('opencc-js/t2cn');
  return OpenCC.Converter({ from: 'tw', to: 'cn' });
}

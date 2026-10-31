// 部署路徑（Vite 的 base）：本機與預設為「/」；部署在子路徑（如 GitHub Pages 的 /biblexer/）時由建置設定。
// 所有同源資源（資料、模型、ORT、Service Worker）都從這裡組出網址。
export const BASE: string = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

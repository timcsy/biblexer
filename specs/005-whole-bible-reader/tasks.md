# Tasks：全本閱讀器

- [X] T001 `tests/unit/reader-world.test.ts`：bookTiles 以 `layout.book` 所在的方塊為世界原點（創世記、羅馬書各測）；實作 `src/reader/world.ts`
- [X] T002 E2E（先紅）：`e2e/whole-bible.spec.ts`——正典層點創世記進入書首；搜尋「迦拿」的約翰福音結果在閱讀器中開啟並標示命中；路得記在兩種寬度下版面座標相同；詩篇進度條章號標籤不重疊；更新 `e2e/reader-zoom.spec.ts`（不再有「尚未提供閱讀」）、`e2e/reader-from-search.spec.ts`（所有結果都有入口）
- [X] T003 實作：Reader 標題與正典層進入任一卷（`Reader.tsx`、`CanonLayer.tsx`）、主頁依書卷快取與開啟（`main.tsx`）、所有結果的「在閱讀器中開啟」（`PassageCard.tsx`）、串珠與經文卡依目前書卷、進度條稀疏章號；確認 T002 通過
- [X] T004 全部測試；vision 階段 4 成功標準加上「閱讀器可開啟全本 66 卷」並勾選；README；spec 002 註明 FR-013、FR-015 的範圍限制已由 spec 005 取代

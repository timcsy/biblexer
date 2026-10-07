# Tasks：串珠（語意近鄰）與原位摺疊比對

- [X] T001 `tests/unit/parallels.test.ts`：合成向量——最相似的段落排第一；排除自身與同章；只回 id 順序（無分數）；k 上限；沒有向量時回空
- [X] T002 實作 `src/core/parallels.ts`；確認 T001 通過
- [X] T003 Worker `parallels` → `parallelsResult`（`tests/unit/worker-protocol.test.ts`、`tests/unit/book.test.ts`）；實作 protocol、engine、client
- [X] T004 `e2e/parallels.spec.ts`（先紅）：開串珠列出不同章段落、無分數；點一筆展開完整經文與「展開全章」；關閉後 data-landing 與相機 transform 不變；方向鍵換段後清單更新
- [X] T005 `src/ui/reader/ParallelsPanel.tsx`、Reader 工具列「串珠」；字串（中性用語，守護測試沿用）；確認 T004 通過
- [X] T006 全部測試；vision 階段 3 第二條成功標準勾選；README
- [X] T007 `tests/unit/xref-sources.test.ts`（先紅）：UBS XML 解析（只取同時含 HEB 與 GRK 的組；範圍如 MRK 10:7-8）；希伯來文編號換算（詩 51:3→51:1、珥 3:1→2:28、瑪 3:19→4:1、創 1:27 不變）；TSK 參照解析（省略書名、只寫節數、範圍、跨章範圍、略過 *marg:／*Gr:、略過帶 passage 屬性的大綱連結）
- [X] T008 實作 `scripts/lib/xref-sources.ts`；確認 T007 通過
- [X] T009 `tests/unit/xrefs.test.ts`（先紅）：參照表編碼／解碼；查一段的參照（依原順序、去重、排除與段落重疊、合併節歸到前一節）
- [X] T010 實作 `src/core/xrefs.ts`；`scripts/build-xrefs.ts` 接進 `build-data.ts`（`sources.json` 加 UBS、TSK、編號對照表三項；UBS 授權檔獨立發布；向量在段落不變時保留）；確認 T009 通過
- [X] T011 資料測試 `tests/data/xrefs.test.ts`：SC-004、SC-005
- [X] T012 Worker：`ParallelsView` 改為分層（quote、tsk、semantic），語意未就緒時前兩層照常（`tests/unit/book.test.ts` 或新測試）；實作 engine
- [X] T013 `e2e/parallels.spec.ts` 新增（先紅）：羅 1 章第一層含哈 2:4 與署名；羅 8:28 段 TSK 層含創 50:20、無英文分組標題；關閉 TSK 層後重開面板不出現
- [X] T014 `ParallelsPanel` 分層呈現、署名、每層開關；字串；確認 T013 通過
- [ ] T015 全部測試；README 署名與授權；vision 階段 3 第一條成功標準；知識回流

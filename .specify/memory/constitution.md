# BibLexer Constitution

專案原則（根公理與衍生原則）見 [`knowledge/principles.md`](../../knowledge/principles.md)，本檔不重複其內容；
原則的任何檢查（包含 `/speckit-plan` 的 Constitution Check）一律以該檔為準。

本檔只規範兩件事：**使用 TDD**，以及**以繁體中文撰寫規格文件與回答**。

## 一、使用 TDD

### 開發循環：Red → Green → Refactor

1. **Red**：先寫測試，描述期望的行為；執行並**親眼確認它失敗**，且失敗原因正是「功能尚未實作」，而不是測試本身寫錯。
2. **Green**：寫出讓測試通過的最少實作。
3. **Refactor**：在測試保持通過的前提下整理程式碼。

沒有先失敗過的測試，就不寫對應的實作。

### 具體規則

- **修 bug**：先寫一個能重現該 bug 的測試，確認它失敗，再修正。
- **任務順序**：`/speckit-tasks` 產生的任務中，每個測試任務 MUST 排在它所驗證的實作任務之前。
- **原則即測試**：`knowledge/principles.md` 中可以自動檢驗的原則，MUST 寫成測試守住；測試名稱或註解標明它守護的是哪一條原則，讓原則被違反時會直接變紅。
- **測試層級**，依對象選擇：
  - 純函式與資料轉換：單元測試。
  - 有數學定義的結構（座標、分數、變換等）：以性質測試（property-based testing）驗證其定義性質，而不只是舉幾個例子。
  - 檢索：以固定查詢集作為驗收測試（見 `knowledge/vision.md` 階段 1）；檢索相關改動不得使結果退步。
  - 介面與互動：以自動化瀏覽器測試驗證可量化的不變量（位置、吸附、上下文是否存在等）。
- **無法自動化的部分**（如縮放手感、觸覺節奏）：MUST 在規格中寫出明確的手動驗證步驟與通過條件；但不得以手動驗證取代能自動化的部分。
- **測試資料**：測試使用固定、可重現的資料（固定的經文片段、固定的模型版本與向量檔），不依賴網路。

### 完成的定義

一個改動只有在以下條件都成立時才算完成：

- 新行為都有先失敗、後通過的測試；
- 全部測試通過，固定檢索查詢未退步；
- 規格中列出的手動驗證步驟已執行並記錄結果。

## 二、以繁體中文撰寫規格文件與回答

- **適用範圍**：spec、plan、research、data-model、contracts、quickstart、tasks、checklist 等所有 Spec Kit 產出的文件，以及對使用者的回答與報告。
- **正體字**：使用繁體中文正確字形與台灣慣用詞，不得混用簡體字。
- **保留原文**：程式碼識別字、檔名、指令、套件名稱與通行的技術術語保留原文；專有概念第一次出現時，可在中文後以括號附上英文原文，例如「倒數排名融合（Reciprocal Rank Fusion, RRF）」。
- **經文引用**：引用經文以和合本原文為準，標明卷、章、節，例如「羅 4:3」「創 15:6」。

<!-- Knowie: Project Knowledge -->
## Project Knowledge

This project maintains structured knowledge in `knowledge/`:

- **Principles** (`knowledge/principles.md`): Core axioms and derived development principles — the project's non-negotiable rules.
- **Vision** (`knowledge/vision.md`): Goals, current state, architecture decisions, and roadmap.
- **Experience** (`knowledge/experience.md`): Distilled lessons from past development — patterns, pitfalls, and takeaways.

Read these files at the start of any task to understand the project's *why* and constraints.
Additional context may be found in `knowledge/concepts/`, `knowledge/history/`, and `knowledge/draft/`.

Learned procedures live in `knowledge/skills/` (agentskills.io SKILL.md format). If your tool auto-loads skills, they may be projected into your skill directory; otherwise read the relevant `SKILL.md` there and follow it.
<!-- /Knowie -->

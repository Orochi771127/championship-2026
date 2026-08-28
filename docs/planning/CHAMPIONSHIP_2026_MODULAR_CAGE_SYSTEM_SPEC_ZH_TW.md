# Championship 2026 模組化籠子／培育地形系統規格

狀態：Owner 核心玩法指令，納入完整重製範圍  
日期：2026-08-29  
適用：9:16 觸控網頁版、PWA 與後續手機封裝

## 1. 不可刪除的原作玩法骨架

籠子不是背景圖，也不是單純把生物分到不同房間。完整重製必須保留：

1. 玩家在有限的培育空間內拼裝／配置具有特定形狀的籠子或功能地形模組；
2. 模組必須依自身格狀 footprint 進行合法放置，不能重疊或超出可用區域；
3. 不同功能地形會影響不同培育數值，讓空間配置成為養成策略；
4. 生物在已配置的籠子環境中生活、訓練、恢復並累積成長結果；
5. 籠子購買、持有、升級、配置、效果與存檔是一條完整的玩法鏈。

這五項屬核心模擬，不得被 Content Pack／Skin 刪除或改成純裝飾。

## 2. 目前證據狀態

| 項目 | 狀態 | 實作規則 |
|---|---|---|
| 籠子可拼裝／配置 | `OWNER_VERIFIED_ORIGINAL_BEHAVIOR` | 必須保留 |
| 功能地形提升不同數值 | `OWNER_VERIFIED_ORIGINAL_BEHAVIOR` | 必須保留效果系統 |
| 各模組具有特定形狀 | `OWNER_VERIFIED_ORIGINAL_BEHAVIOR` | 必須使用 shape mask，不得全部退化成同尺寸卡片 |
| 40 個 `field_cm` 物理場地資產組 | `VERIFIED_BINARY` | 作為研究 crosswalk；原圖不進公開版 |
| 36 個 CageDefinitions：35 商店籠子＋1 Waiting Room | `VERIFIED_BINARY` | 保留資料容量與 ownership 分離 |
| 初始 14 格、擴充至 20 格 | `WEB_CROSSCHECK_PENDING_BINARY` | schema 預留，不先宣稱精確 parity |
| Attack／Defense／HP／TP／Speed／Wisdom、家族、屬性抗性、恢復與自動化效果族 | `WEB_CROSSCHECK_PENDING_BINARY` | 建立效果通道；精確映射與數值仍需追蹤 |
| 每個原作模組的格狀 footprint | `UNKNOWN_REQUIRES_TRACE` | 先用中性測試形狀，原作 parity 資料不可猜 |
| 旋轉、鏡射、鄰接、堆疊、效果 tick 與上限 | `UNKNOWN_REQUIRES_TRACE` | 沒有證據前保持關閉或標成產品測試規則 |

Owner 的確認補足「系統必須存在」的權威；它不自動證明尚未取得的形狀表與數值表。

## 3. 模擬資料模型

核心資料不得使用美術檔名當 ID。建議穩定結構：

```text
CageBoard
  boardId
  boardMask
  unlockedCellCount
  placements[]

CagePlacement
  placementId
  moduleId
  anchorCell
  orientation
  occupiedCells[]
  assignedResidentIds[]

CageModuleDefinition
  moduleId
  shapeMask
  allowedOrientations[]
  capacity
  effectProfileId
  level
  unlockRuleId
  presentationKey
  evidenceState

TrainingEffectProfile
  effectProfileId
  channels[]
  cadence
  stackingRule
  capRule
  evidenceState
```

- `shapeMask`、碰撞、容量、效果計算和存檔屬 gameplay data；
- `presentationKey` 對應可替換的地形美術、動畫、名稱、圖示與音效；
- Skin 可以換外觀，不能悄悄改變 shape mask 或培育效果；
- 若未來提供不同規則包，必須有獨立版本號、平衡標記與存檔遷移，不可偽裝成換皮。

## 4. 9:16 觸控 Cage Edit

畫面由 PixiJS 培育場與 DOM 工具層共同構成：

- 中央：可縮放／平移的培育格狀區，正式遊玩隱藏除錯格線；
- 下方抽屜：已持有模組、功能分類、等級、形狀縮圖與效果摘要；
- 拖曳時：顯示半透明 footprint、吸附位置、有效綠色／無效紅色回饋；
- 放置前：預覽受影響數值，不先寫入存檔；
- 編輯列：復原、重做、移除、旋轉（僅在規則允許時）、取消、確認；
- 確認後：以單一原子交易寫入配置、重新計算效果並保存；
- 中斷、返回或瀏覽器失焦時，不得留下半套配置。

觸控、滑鼠與鍵盤／手把都映射到相同語意動作：選取、拿起、移動、旋轉、放置、取消、確認。

## 5. 效果解析原則

培育 tick 只讀取已確認配置：

```text
confirmed placements
  -> validate occupied cells and ownership
  -> resolve resident-to-cage membership
  -> collect active TrainingEffectProfiles
  -> apply verified cadence / stacking / caps
  -> emit explainable stat delta events
  -> commit through the single save authority
```

在精確原作公式完成追蹤前，功能沙盒可以使用 `PRODUCT_AUTHORED_NEUTRAL_TUNING`，但 UI、測試報告與資料列必須明確標記，不能宣稱為原作數值。

## 6. 最低可玩驗收

- 至少三種不同 footprint 的中性原創模組可放置、移動與移除；
- 重疊、越界、未解鎖區和不合法 orientation 必須被阻止；
- 至少三個效果通道能在預覽中指出會受影響的數值；
- 確認後經一個 deterministic training tick 產生可重播的變化；
- 取消不改變模擬狀態；確認後儲存、重新載入會還原相同形狀、位置、方向與效果；
- 360×800、390×844、393×852、412×915、430×932 均可單手完成編輯；
- 換掉整套地形美術後，shape、配置、效果和存檔結果完全一致；
- 原作精確形狀與效果完成追蹤後，以資料替換中性測試值，不重寫編輯器或模擬器。

## 7. 必要測試

- shape transform／orientation 的單元與 property tests；
- overlap、out-of-bounds、locked-cell 與 capacity 驗證；
- 效果堆疊、上限、tick 次序及 deterministic replay；
- 放置交易 rollback、存檔 migration、損壞資料拒絕與復原；
- pointer capture、`pointercancel`、失焦、旋轉螢幕與安全區；
- Skin replacement 測試：只換 presentation manifest，不得改變 replay hash。


# 製裝模擬器（製裝方法 → 模擬器）

## 檔案

| 檔案 | 作用 |
|---|---|
| `craft-data.js` | 自動產生的資料（底材、詞綴、詞綴文字），約 0.45 MB。**不要手改**，用下面的腳本重新產生。 |
| `craft-engine.js` | 核心規則（純函式）：詞綴池、權重、tier、各通貨效果、批次模擬。瀏覽器／Web Worker／Node 都能載入。 |
| `craft-ui.js` | 「模擬器」子分頁的畫面。 |
| `craft-worker.js` | 批次模擬的 Web Worker（頁面不會卡）。用 `file://` 直接開網頁時 Worker 不能用，會自動改成在頁面上分批跑。 |
| `tools/build_craft_data.py` | 下載 RePoE 資料、篩選、輸出 `craft-data.js`。 |
| `tools/test_craft_engine.js` | 自我檢查（`node tools/test_craft_engine.js`）。 |

`index.html` 只在第一次打開「製裝方法」分頁時才載入 `craft-data.js`、`craft-engine.js`、`craft-ui.js`。

## 遊戲改版時更新資料

```
python tools/build_craft_data.py
node tools/test_craft_engine.js
```

腳本會把 RePoE 檔案下載到 `tools/_repoe_cache/`（已加進 .gitignore），再輸出 `craft-data.js`。
如果已經手動下載過，可以用 `--src 資料夾` 跳過下載。輸出超過 3 MB 會報錯；有沒實作的數值換算（index_handlers）會印警告。

## 資料來源與版本

- **RePoE**（PoE1）：https://github.com/lvlvllvlvllvlvl/RePoE ，資料網址 https://repoe-fork.github.io/
  - 用到 `mods.json`、`base_items.json`、`stat_translations.json`、`version.txt`
  - 繁中：`Traditional Chinese/stat_translations.json`（詞綴中文模板）、`Traditional Chinese/base_items.json`（底材中文名），
    下載後存成 `_repoe_cache/zh_*.json`

## 中文顯示

- `craft-data.js` 英文、中文都有：每筆詞綴文字的 `v` 是英文模板、`z` 是中文模板；底材的 `n` 英文名、`nz` 中文名、`is` 固有詞綴的數值範圍。
- 中文和英文用同一套規則選模板、換算數值（condition、format、index_handlers），只是換成中文字串。
  範圍文字（例如「+(115-129) 最大生命」）也是用模板組出來的；英文範圍直接用 RePoE 的 `text`。
- 某條沒有中文就顯示英文。build 腳本最後會印出缺中文的數量和前 20 個 id（3.29.3.3：0 條）。
- 「中／EN」切換在製裝方法分頁右上角，存在 localStorage（`poe-craft-lang`），程式在 index.html 的載入程式（`window.CraftLang`，切換時發出 `craftlang` 事件）。
- 中文模式不組魔法／稀有物品的名稱，說明框標題只顯示底材中文名。按住 Alt 時，中文詞綴底下用灰色小字附英文原文。
- 存檔（v3）記底材的 Metadata 路徑和詞綴 id（`craft-engine.js` 的 `toStored`／`fromStored`），不記編號，每季更新資料後也讀得回來；讀到舊格式（v2，記編號）時用目前這版資料轉換，下次存檔就以 v3 寫回。
- 詞綴中文名稱來自 RePoE 的 `Traditional Chinese/mods.json`（`nz` 欄位）。
- 每季更新資料：雙擊專案根目錄的 `更新製裝資料.bat`（`tools/update_craft_data.py`，會檢查版本、寫差異報告到 docs/、差異超過 10% 停下來確認、跑測試）。
  - 目前資料的遊戲版本：**3.29.3.3**（2026-10-21 下載，伺服器最後更新 2026-10-19）
  - 授權：程式碼 MIT（Copyright (c) 2016 brather1ng）。匯出的遊戲資料版權屬 Grinding Gear Games，需遵守其使用條款。
- **Kalandralang**：https://github.com/doomeer/kalandralang ，MIT（Copyright (c) 2022 DooMeeR）
  - 只參考通貨規則的邏輯（`src/item.ml`、`src/interpreter.ml`），用 JavaScript 重寫，沒有搬程式碼。

## 篩選規則（build_craft_data.py）

- 底材：`domain` 為 item、`release_state` 為 released 的武器、護甲（頭、身、手、鞋、盾）、飾品（戒指、項鍊、腰帶）。
  排除護身符（talisman）和 Royale（大逃殺活動）底材。不含珠寶、星團、地圖、藥劑、箭袋。
- 詞綴：`domain` 為 item、`generation_type` 為 prefix／suffix，且至少在一個上述底材上權重 > 0。排除 id 含 Royale 的活動詞綴。
  勢力、精髓、化石限定等詞綴在一般底材上權重都是 0，自然被排除。

## 規則（照 Kalandralang）

- 詞綴池：`required_level ≤ 物品等級`；權重取 `spawn_weights` 依序第一個物品也有的 tag，≤ 0 或沒對到就排除；
  再乘上 `generation_weights`（百分比，取整數）。物品的 tag ＝ 底材 tag ＋ 身上詞綴的 `adds_tags`（例如 has_attack_mod）。
- 已有同 `groups` 的前後綴就排除；前後綴上限魔法各 1、稀有各 3。
- 詞綴數：蛻變／改造 1～2 條（50 : 50）；點金／混沌 4～6 條（8 : 3 : 1）；池子空了就停。這兩組機率是 Kalandralang 採用的社群推定值，不是官方數字。
- 模擬器的平均＝全部用量（含失敗的件數）÷ 成功件數；中位數、90% 是「每做出一件成功品總共用掉多少」（沒中就重新開始，前面用掉的累加上去）。
- 增幅、崇高、富豪各加 1 條；無效石隨機拿掉 1 條（稀有度不變）；重鑄清空並變回普通；神聖重骰所有數值。
- Tier：同一個 mod `type`、能出現在這個底材上的詞綴（不看物品等級），依需求等級由高到低、同等級再比數值總和，第一個是 T1。
- 和 Kalandralang 不同的地方：重鑄普通物品、神聖／無效石用在沒有詞綴的物品會被拒絕並顯示原因（Kalandralang 是不做事）。

## 第一版不做

勢力、分裂、精髓、化石、工藝台、收穫、珠寶。（精髓、工藝台、化石、豐收後來已加入，見下面各節。）

**機會石（Orb of Chance）、瓦爾寶珠（Vaal Orb）**：Kalandralang（查到 2026-01-06 的 master `5a6d1fb`）兩顆都沒有實作，
沒有可以照的規則，所以先不做。它們和其他「模擬器尚未支援」的通貨一樣，只在製裝台通貨頁當擺設（`craft-bench.js` 的 `DECOR_SLOT`）。

## 製裝台通貨頁

- 「一般」用 `stash_page_A` 的格子；可用的通貨在 `craft-bench.js` 的 `CURRENCY_SLOT`，擺設在 `DECOR_SLOT`（格子編號是 `stash_layouts.json` 的 `i`）。
- 擺設的圖示和中英文名在 `build_craft_data.py` 的 `DECOR_BASES`，產生在 `craft-data.js` 的 `decor`。
- 某顆擺設做成可用時：在 `craft-engine.js` 的 `CURRENCIES` 加規則、`build_craft_data.py` 從 `DECOR_BASES` 搬到 `CURRENCY_BASES`、
  `craft-bench.js` 從 `DECOR_SLOT` 搬到 `CURRENCY_SLOT`。

## 精髓（2026-10-22 加入）
- 資料：RePoE `essences.json`（＋繁中版）。共 105 種：低語～破空、腐化精髓 4 種、荒蕪精髓；遺忘的污染器皿沒有詞綴（3.27 起已移除），不收。
- 普通物品 → 稀有，並保證一條詞綴；稀有物品只有咆哮以上（含腐化精髓）可以重鑄。魔法物品、有元工藝的物品都不能用。
- 低階精髓的其他隨機詞綴有等級上限：低語 35、呢喃 45、啼泣 60、哀嚎 75（RePoE `item_level_restriction`，poewiki Essence）。
- 詞綴條數照 Kalandralang：保證詞綴之外補到 4～6 條（8 : 3 : 1，社群推定值）。
- 精髓專屬詞綴標記 `d: "e"`，不會出現在一般詞綴池；tier 用數值總和換算成「相當於一般詞綴的第幾階」（模擬器自己的換算）。
- 待確認：荒蕪精髓能不能重鑄稀有物品（目前只能用在普通物品）；符文匕首、戰杖在 RePoE 沒有精髓詞綴（目前不能用）。

## 工藝台＋元工藝（2026-10-22 加入）
- 資料：RePoE `crafting_bench_options.json`。收「加詞綴」（718 個，限我們有的物品類別）、「移除工藝詞綴」、3.29 新增的「重抽 3 條／1 條詞綴」；插槽、連線、顏色、附魔、重骰稀有度不收（模擬器沒有這些）。
- 工藝詞綴標記 `d: "c"`；元工藝用群組辨認（`ItemGenerationCannotChangePrefixes` 等）。
- 規則：每件 1 條工藝詞綴（「可以有 3 條工藝詞綴」時最多 3 條，本身也算）；照一般詞綴規則（空位、同群組）；已有 1 條時再做＝取代，多 1 顆重鑄石。
- 元工藝和每顆通貨的互動照 poewiki Meta-crafting mod 的對照表，測試在 `tools/test_craft_engine.js`（每一格一項）。
- 照 Kalandralang（poewiki 沒寫，待確認）：普通物品做工藝詞綴會變魔法；工藝詞綴不看物品等級；鎖住一邊後重鑄石依剩下詞綴數決定稀有度。
- 3.29 的「重抽 3 條／1 條詞綴」：規則待確認，只列出、不能用。

## 存檔
- v3 存 id，不受編號變動影響。v2（記編號）的舊存檔用 `tools/legacy_v2_index.json`（3.29.3.3 當時的順序，固定不改）轉換；資料多了精髓、工藝詞綴後編號已經位移，所以不能再用目前的編號解讀 v2。
- 製裝相關檔案在 index.html 加了版本號（`VER`、`craft-bench.css?v=`），改這些檔案時要一起改，否則瀏覽器可能用舊檔。

## 倉庫頁排列（2026-10-22 加入）
- 精髓頁的格子位置照遊戲資料 `EssenceStashTabLayout`：RePoE 沒有，用 `tools/extract_stash_layout.py`（pathofexile-dat，從官方更新伺服器）抽成 `tools/stash_layout_game.json`，每季更新腳本會自動重抽。
- `build_craft_data.py` 把遊戲座標對到背景圖 `stash_page_D` 的格子（固定比例＋最佳平移），結果放在 `craft-data.js` 的 `essTab`。對不齊（例如新賽季多了精髓）時會印警告，網頁改用依序排列。
- 遊戲資料：104 種精髓各有專屬格、4 個通用格、1 個大格。荒蕪精髓沒有專屬格，網頁放在第一個通用格。
- 通貨頁：`CurrencyStashTabLayout` 的「一般」（SlotGroup 0，52 格）和目前的背景圖 `stash_page_A`（69 格）對不起來，`CURRENCY_SLOT`／`DECOR_SLOT` 仍是手動設定；SlotGroup 1 ↔ `stash_currency_general`、SlotGroup 3 ↔ `stash_page_B` 對得上。
- 2026-10-22 更新：通貨頁「一般」改用官方 3.29 美術圖（`mtx/currencystash/4k/backgroundbase.dds` → `img/craft/stash_currency_official.webp`）＋ `CurrencyStashTabLayout`（SlotGroup 0＋3）。`extract_stash_layout.py` 會取出美術圖、用影像分析算出遊戲座標 → 圖上像素的換算（需要 Pillow、numpy），`build_craft_data.py` 產生 `craft-data.js` 的 `curTab`。手動的 `CURRENCY_SLOT`／`DECOR_SLOT` 已移除；版面上其他通貨自動加成擺設。隱藏格（ShowIfEmpty＝否）倉庫裡沒有該物品時不顯示。原本的截圖背景 `stash_page_A` 移到 `備份\通貨頁截圖背景_2026-10-22\`。

## 工藝台介面（2026-10-22 加入）
- 美術圖：`tools/extract_ui_art.py` 讀遊戲的介面圖集切割表 `art/uiimages1.txt`，從官方圖集切出元件存成 `img/craft/ui/*.webp`（清單在 `img/craft/ui/manifest.json`），每季更新腳本會自動重抽。
  - 工藝台：金色翅膀物品格（MasterCraftingItem）、上方橫條（MasterCraftingTopBG）、分區標題（ModTypeBG）、列底（MasterCraftingRecipeDefault／Hover／Selected）、階級盾牌（Tier1～5、TierNone）、物品類別分頁（FilterButtons、Icons）。
  - 園藝工藝台（備用，功能這次不做）：藤蔓外框＋標題牌（Harvest/RewardUIBaseSimplified）、面板（RewardInfoPanel）、生命力計數框；生命力圖示用物品圖檔（art/2ditems/currency/harvest/*lifeforce.dds）。
  - 沒找到、用 CSS 模擬：清單面板的深色底、搜尋框（遊戲裡是多個通用小元件拼成，切割表沒有整張）。
- 物品類別分頁：遊戲資料 `CraftingItemClassCategories`（英文／繁中名稱、包含的物品類別），放在 `craft-data.js` 的 `benchUI.tabs`。
- 每列的「lvl」＝做完後裝備的角色需求等級＝詞綴等級的 80%（無條件捨去），和遊戲畫面一致。遊戲資料 `CraftingBenchOptions.RequiredLevel` 對裝備詞綴都是 0，物品等級不限制工藝台（Kalandralang 也不檢查）。

## 通貨頁「輿圖」「聯盟」、化石（2026-10-22 加入）
- 「輿圖」（SlotGroup 1）「聯盟」（SlotGroup 2）：遊戲的整張輿圖背景（BackgroundAtlas）是舊版面、和 3.29 排列資料對不上，所以用官方空白底圖（CurrencyBackground）＋官方格框（Currency1x1Slot、CurrencyCentreSlot）照 3.29 的 CurrencyStashTabLayout 組成（`extract_stash_layout.py` 的 `compose_tabs`）。用同樣方法組出的「一般」頁和官方整張圖一致。
- 化石：RePoE `fossils.json`（＋繁中）。權重 100＝×1；禁止的標籤優先；每顆化石對同一條詞綴只算一次；多顆化石的「增加」可切換相加（預設）／相乘（社群推定值）；減少（×0.15）相乘。鏤空化石保證深淵插槽（限武器、頭盔、手套、鞋子、胸甲），雕琢化石加入化石專屬的寶石等級詞綴。
- 待確認先禁用：神聖、雕紋、紊亂、破裂、血漬、鑲金、華麗（原因寫在 `build_craft_data.py` 的 `FOSSIL_HOLD`）。
- 鑄新儀（共振器）：普通物品＝點金效果、稀有物品＝混沌效果；魔法物品、有元工藝不能用；鑄新儀要插滿才能用：混沌鑄新儀 初階 1、強效 2、強力 3、終極 4 孔（RePoE 沒有，KAI 在遊戲內確認）；點金鑄新儀照同樣等級（待確認）。
- 化石倉庫頁：官方背景圖 DelveTabBackground＋DelveStashTabLayout（`extract_stash_layout.py` 的 `delve_art`，用格框亮線自動對位）。

## 豐收（園藝工藝台，2026-10-22 加入）
- 資料：遊戲資料表 `HarvestCraftOptions`（`extract_ui_art.py` 的 `harvest_options` 用 pathofexile-dat 抽英文＋繁中，存成 `tools/harvest_options.json`），`build_craft_data.py` 的 `harvest_options` 轉成 `D.harvest`。全部 74 個選項和截圖對照表在 `docs/2026-10-22_豐收選項.md`。
- 生命力：野性 `x:HarvestSeedRed`、靈現 `x:HarvestSeedGreen`、原始 `x:HarvestSeedBlue`、神聖 `x:HarvestSeedBoss`、晶化仇怨 `x:HarvestSeedFaridun`；使用量和其他通貨一樣記在 `currencyUsed`。
- 已實作（照 Kalandralang）：「重鑄並包含 1 個 X 詞綴」（`reforge_rare ~tag`）、「增加 1 個新 X 詞綴並移除其它隨機詞綴」（`harvest_augment_and_remove`）。X＝詞綴的 `implicit_tags`。
- 待確認先禁用：機率較大／較小（參數 900／-90 的意思不確定）、抗性／傷害互換（「相似階級」沒有公布）。原因寫在 `build_craft_data.py` 的 `HARVEST_HOLD`；勢力、附魔、通貨交換等標成不適用（`HARVEST_NA`）。
- 介面：`craft-harvest.js`（製裝台「園藝」按鈕、模擬器「園藝工藝台…」共用），美術圖 `harvest_window`、`harvest_panel`、`harvest_side`、`harvest_slot`、`harvest_counter`、`lifeforce_*`。模擬器作法「豐收重鑄」只能選「重鑄並包含」。

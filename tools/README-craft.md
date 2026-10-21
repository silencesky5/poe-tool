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
- 存檔只記底材、詞綴的編號，跟語言無關；加中文欄位時沒有改動編號順序。
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
- 詞綴數：蛻變／改造 1～2 條（50 : 50）；點金／混沌 4～6 條（8 : 3 : 1）；池子空了就停。
- 增幅、崇高、富豪各加 1 條；無效石隨機拿掉 1 條（稀有度不變）；重鑄清空並變回普通；神聖重骰所有數值。
- Tier：同一個 mod `type`、能出現在這個底材上的詞綴（不看物品等級），依需求等級由高到低、同等級再比數值總和，第一個是 T1。
- 和 Kalandralang 不同的地方：重鑄普通物品、神聖／無效石用在沒有詞綴的物品會被拒絕並顯示原因（Kalandralang 是不做事）。

## 第一版不做

勢力、分裂、精髓、化石、工藝台、收穫、珠寶。

**機會石（Orb of Chance）、瓦爾寶珠（Vaal Orb）**：Kalandralang（查到 2026-01-06 的 master `5a6d1fb`）兩顆都沒有實作，
沒有可以照的規則，所以先不做。它們和其他「模擬器尚未支援」的通貨一樣，只在製裝台通貨頁當擺設（`craft-bench.js` 的 `DECOR_SLOT`）。

## 製裝台通貨頁

- 「一般」用 `stash_page_A` 的格子；可用的通貨在 `craft-bench.js` 的 `CURRENCY_SLOT`，擺設在 `DECOR_SLOT`（格子編號是 `stash_layouts.json` 的 `i`）。
- 擺設的圖示和中英文名在 `build_craft_data.py` 的 `DECOR_BASES`，產生在 `craft-data.js` 的 `decor`。
- 某顆擺設做成可用時：在 `craft-engine.js` 的 `CURRENCIES` 加規則、`build_craft_data.py` 從 `DECOR_BASES` 搬到 `CURRENCY_BASES`、
  `craft-bench.js` 從 `DECOR_SLOT` 搬到 `CURRENCY_SLOT`。

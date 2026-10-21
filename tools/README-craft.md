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
- 增幅、崇高、富豪各加 1 條；剝離隨機拿掉 1 條（稀有度不變）；重鑄清空並變回普通；神聖重骰所有數值。
- Tier：同一個 mod `type`、能出現在這個底材上的詞綴（不看物品等級），依需求等級由高到低、同等級再比數值總和，第一個是 T1。
- 和 Kalandralang 不同的地方：重鑄普通物品、神聖／剝離沒有詞綴的物品會被拒絕並顯示原因（Kalandralang 是不做事）。

## 第一版不做

勢力、分裂、精髓、化石、工藝台、收穫、珠寶。

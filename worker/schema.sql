-- 製裝存檔（Cloudflare D1）。每個 Discord 帳號一筆。
-- WITHOUT ROWID：主鍵就是資料存放的順序，不會另外產生隱藏索引，每次寫入只算 1 筆 rows written。
-- 不要再加其他索引：每個索引都會讓每次寫入多算 1 筆。
CREATE TABLE IF NOT EXISTS stash (
  discord_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,          -- 存檔內容（JSON 字串）
  updated_at INTEGER NOT NULL  -- 毫秒，給前端判斷版本衝突
) WITHOUT ROWID;

-- 公會分享架（複製制：分享出去的是快照，別人只能複製一份，原件留在架上）。
-- 和 stash 表分開，不動到存檔。同樣 WITHOUT ROWID、不加索引：
--   分享＝新增 1 筆、撤下＝刪除 1 筆、複製＝更新 1 筆（被複製次數 +1），每次都只寫 1 筆。
--   全架最多 100 件，查「某人有幾件」「1 分鐘內分享幾件」直接掃整張表就好（讀取不算寫入）。
CREATE TABLE IF NOT EXISTS guild_shares (
  id TEXT PRIMARY KEY,              -- 隨機 id（網址 #craft&share=<id> 用）
  sharer_id TEXT NOT NULL,          -- 分享者 Discord ID
  sharer_name TEXT NOT NULL,        -- 分享者名稱（分享當時的伺服器暱稱）
  item TEXT NOT NULL,               -- 裝備（存檔 v3 格式 JSON：底材 Metadata 路徑＋詞綴 id，穩定 id）
  note TEXT NOT NULL DEFAULT '',    -- 備註（最多 50 字）
  shared_at INTEGER NOT NULL,       -- 分享時間（毫秒）
  copies INTEGER NOT NULL DEFAULT 0,-- 被複製次數
  data_version TEXT NOT NULL DEFAULT '' -- 分享時的遊戲資料版本（改版後讀不回來時顯示用）
) WITHOUT ROWID;

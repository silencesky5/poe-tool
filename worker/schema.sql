-- 製裝存檔（Cloudflare D1）。每個 Discord 帳號一筆。
-- WITHOUT ROWID：主鍵就是資料存放的順序，不會另外產生隱藏索引，每次寫入只算 1 筆 rows written。
-- 不要再加其他索引：每個索引都會讓每次寫入多算 1 筆。
CREATE TABLE IF NOT EXISTS stash (
  discord_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,          -- 存檔內容（JSON 字串）
  updated_at INTEGER NOT NULL  -- 毫秒，給前端判斷版本衝突
) WITHOUT ROWID;

"""
從遊戲資料抽出工藝台、園藝工藝台介面的官方美術圖（不用截圖去背），存成 img/craft/ui/*.webp。

做法：讀遊戲的介面圖集切割表 art/uiimages1.txt（每一行：元件名稱、圖集 .dds、左上 x y、右下 x y），
用 pathofexile-dat（tools/poedat_getfile.mjs）從官方更新伺服器取出圖集，依座標切出元件。
需要 Node.js、Pillow。每季更新腳本（update_craft_data.py）會自動呼叫；失敗時保留舊的圖。

用法：
    python tools/extract_ui_art.py 3.29.3.3
輸出清單（找到／沒找到）寫在 img/craft/ui/manifest.json；另外匯出工藝台的物品類別分頁
（CraftingItemClassCategories：分頁代碼、英文／繁中名稱、包含哪些物品類別）放在 manifest 的 benchTabs。
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "img", "craft", "ui")
SHEET_INDEX = "art/uiimages1.txt"

# 輸出檔名 → 切割表裡的元件名稱（去掉 "Art/2DArt/UIImages/InGame/" 開頭）
BENCH = {
    "bench_item": "CraftingWindow/MasterCraftingItem",          # 上方金色翅膀＋物品格
    "bench_top": "CraftingWindow/MasterCraftingTopBG",          # 上方橫條
    "bench_row": "CraftingWindow/MasterCraftingRecipeDefault",  # 每一列的底
    "bench_row_hover": "CraftingWindow/MasterCraftingRecipeHover",
    "bench_row_selected": "CraftingWindow/MasterCraftingRecipeSelected",
    "bench_section": "CraftingWindow/ModTypeBG",                # 「前綴」「後綴」分區標題
    "bench_titlebar": "CraftingWindow/WindowTitlebarThin",
    "tier1": "CraftingWindow/Tier1", "tier2": "CraftingWindow/Tier2", "tier3": "CraftingWindow/Tier3",
    "tier4": "CraftingWindow/Tier4", "tier5": "CraftingWindow/Tier5", "tier0": "CraftingWindow/TierNone",
}
# 物品類別分頁：圖示（44×44）
FILTERS = ["All", "1Claw", "1HandAxe", "1HandMace", "1HandSword", "1HandedMelee", "1HandedRange", "1Staff",
           "2HandMace", "2HandSword", "2HandedMelee", "2HandedRange", "Amulet", "Armour", "Belt", "Boots",
           "Flask", "Gloves", "Helmet", "Quiver", "Ring", "Shield"]
for f in FILTERS:
    BENCH["filter_" + f] = "CraftingWindow/Icons/" + f
    BENCH["filterbtn_" + f] = "CraftingWindow/FilterButtons/" + f + "Default"
    BENCH["filterbtn_" + f + "_on"] = "CraftingWindow/FilterButtons/" + f + "Selected"
HARVEST = {
    "harvest_window": "Harvest/RewardUIBaseSimplified",   # 藤蔓外框＋金色標題牌
    "harvest_panel": "Harvest/RewardInfoPanel",
    "harvest_panel_hover": "Harvest/RewardInfoPanelHover",
    "harvest_counter": "Harvest/HarvestLifeforceCounter",
    "harvest_side": "Harvest/CraftingBase",              # 右側放物品的面板（藤蔓＋物品格）
    "harvest_slot": "Harvest/CraftingLargeSlot",
}
# 生命力：物品圖示（不在介面圖集裡）
LIFEFORCE = {
    "lifeforce_wild": "art/2ditems/currency/harvest/wildlifeforce.dds",
    "lifeforce_vivid": "art/2ditems/currency/harvest/vividlifeforce.dds",
    "lifeforce_primal": "art/2ditems/currency/harvest/primallifeforce.dds",
    "lifeforce_sacred": "art/2ditems/currency/harvest/sacredlifeforce.dds",
}
# 找不到官方圖、網頁改用 CSS 模擬的元件（記在 manifest，方便之後再找）
NOT_FOUND = {
    "bench_panel": "工藝台清單的深色面板底（遊戲是由多個小元件拼成，切割表裡沒有整張；網頁用 CSS 漸層＋邊框模擬）",
    "bench_search": "搜尋框（遊戲用通用輸入框元件；網頁用 CSS）",
}


def getfile(work, patch, path, out):
    from extract_stash_layout import tool_cmd, TOOL_DIR
    node = tool_cmd()[0]
    r = subprocess.run([node, os.path.join(HERE, "poedat_getfile.mjs"), TOOL_DIR, os.path.join(work, ".cache"),
                        patch, path, out], stdout=subprocess.DEVNULL)
    if r.returncode != 0:
        raise RuntimeError("取不到 " + path)
    return out


def bench_tabs(work, patch):
    """工藝台的物品類別分頁（有圖示代碼的才收）：[{code, en, zh, classes}]"""
    from extract_stash_layout import tool_cmd
    d = os.path.join(work, "tabs")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "config.json"), "w", encoding="utf-8") as f:
        json.dump({"patch": patch, "translations": ["English", "Traditional Chinese"], "files": [], "tables": [
            {"name": "CraftingItemClassCategories", "columns": ["Id", "ItemClasses", "CategoryCode", "Text"]},
            {"name": "ItemClasses", "columns": ["Id"]}]}, f)
    if subprocess.run(tool_cmd(), cwd=d, stdout=subprocess.DEVNULL).returncode != 0:
        raise RuntimeError("匯出 CraftingItemClassCategories 失敗")
    t = lambda lang, n: json.load(open(os.path.join(d, "tables", lang, n + ".json"), encoding="utf-8"))
    en = t("English", "CraftingItemClassCategories")
    zh = t("Traditional Chinese", "CraftingItemClassCategories")
    ic = t("English", "ItemClasses")
    return [{"code": r["CategoryCode"], "en": r["Text"], "zh": z["Text"], "classes": [ic[i]["Id"] for i in r["ItemClasses"]]}
            for r, z in zip(en, zh) if r["CategoryCode"]]


def harvest_options(work, patch):
    """園藝工藝台的全部選項（HarvestCraftOptions，英文＋繁中）存成 tools/harvest_options.json。
    LifeforceType：1 野性（紅）、2 靈現（黃）、3 原始（藍）；SacredCost 神聖（白）；RancourCost 晶化仇怨（第五種）。"""
    from extract_stash_layout import tool_cmd
    d = os.path.join(work, "harvest")
    os.makedirs(d, exist_ok=True)
    cols = ["Id", "Text", "Command", "Parameters", "LifeforceType", "LifeforceCost", "SacredCost", "RancourCost",
            "IsProportionalToStackSize", "IsEnchant"]
    with open(os.path.join(d, "config.json"), "w", encoding="utf-8") as f:
        json.dump({"patch": patch, "translations": ["English", "Traditional Chinese"], "files": [],
                   "tables": [{"name": "HarvestCraftOptions", "columns": cols}]}, f)
    if subprocess.run(tool_cmd(), cwd=d, stdout=subprocess.DEVNULL).returncode != 0:
        raise RuntimeError("匯出 HarvestCraftOptions 失敗")
    en = json.load(open(os.path.join(d, "tables", "English", "HarvestCraftOptions.json"), encoding="utf-8"))
    zh = json.load(open(os.path.join(d, "tables", "Traditional Chinese", "HarvestCraftOptions.json"), encoding="utf-8"))
    rows = [{"id": r["Id"], "en": r["Text"], "zh": z["Text"], "cmd": r["Command"], "par": r["Parameters"],
             "lf": r["LifeforceType"], "n": r["LifeforceCost"], "sacred": r["SacredCost"], "rancour": r["RancourCost"],
             "stack": r["IsProportionalToStackSize"], "enchant": r["IsEnchant"]} for r, z in zip(en, zh)]
    out = os.path.join(HERE, "harvest_options.json")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"patch": patch, "source": "pathofexile-dat HarvestCraftOptions", "options": rows}, f,
                  ensure_ascii=False, indent=1)
    print(f"園藝工藝台選項 {len(rows)} 個 → {out}")


def parse_sheet(text):
    """切割表：一行一個元件 "名稱" "圖集" x0 y0 x1 y1（x1、y1 含在內）"""
    defs = {}
    for line in text.splitlines():
        m = re.match(r'\s*"([^"]+)"\s+"([^"]+)"\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)', line)
        if m:
            name = m.group(1).replace("Art/2DArt/UIImages/InGame/", "")
            defs[name] = (m.group(2), *map(int, m.group(3, 4, 5, 6)))
    return defs


def extract(patch):
    from PIL import Image
    sys.path.insert(0, HERE)
    os.makedirs(OUT_DIR, exist_ok=True)
    work = tempfile.mkdtemp(prefix="poe-ui-art-")
    try:
        raw = open(getfile(work, patch, SHEET_INDEX, os.path.join(work, "sheet.txt")), "rb").read()
        defs = parse_sheet(raw.decode("utf-16-le", errors="replace").lstrip("﻿"))
        sheets, found, missing = {}, {}, {}
        for out, name in {**BENCH, **HARVEST}.items():
            d = defs.get(name)
            if not d:
                missing[out] = name
                continue
            sheet, x0, y0, x1, y1 = d
            if sheet not in sheets:
                p = getfile(work, patch, sheet.lower(), os.path.join(work, "s%d.dds" % len(sheets)))
                sheets[sheet] = Image.open(p).convert("RGBA")
            sheets[sheet].crop((x0, y0, x1 + 1, y1 + 1)).save(os.path.join(OUT_DIR, out + ".webp"), lossless=False,
                                                                quality=90, method=6)
            found[out] = {"name": name, "w": x1 - x0 + 1, "h": y1 - y0 + 1}
        for out, path in LIFEFORCE.items():
            try:
                im = Image.open(getfile(work, patch, path, os.path.join(work, out + ".dds"))).convert("RGBA")
                im.save(os.path.join(OUT_DIR, out + ".webp"), quality=90, method=6)
                found[out] = {"name": path, "w": im.width, "h": im.height}
            except Exception:
                missing[out] = path
        manifest = {"patch": patch, "source": "pathofexile-dat（官方更新伺服器）＋ " + SHEET_INDEX,
                    "found": found, "missing": missing, "css": NOT_FOUND, "benchTabs": bench_tabs(work, patch)}
        harvest_options(work, patch)
        with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)
        size = sum(os.path.getsize(os.path.join(OUT_DIR, k + ".webp")) for k in found)
        print(f"介面美術圖：找到 {len(found)} 個、沒找到 {len(missing)} 個（{size / 1024:.0f} KB）→ {os.path.abspath(OUT_DIR)}")
        for k, v in missing.items():
            print("  沒找到：", k, v)
        return manifest
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        print("用法：python tools/extract_ui_art.py <patch 版本，例如 3.29.3.3>")
        sys.exit(1)
    sys.path.insert(0, HERE)
    extract(sys.argv[1])

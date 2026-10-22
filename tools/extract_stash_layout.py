"""
從遊戲資料抽出倉庫頁的排列表（精髓頁、通貨頁），存成 tools/stash_layout_game.json。

RePoE fork 沒有發布這兩張表，所以用 pathofexile-dat（MIT，https://github.com/SnosMe/poe-dat-viewer）
從官方更新伺服器下載 3.29 的遊戲資料，匯出 EssenceStashTabLayout、CurrencyStashTabLayout。
另外取出通貨頁「一般」的官方美術圖（mtx/currencystash/4k/backgroundbase.dds），存成
img/craft/stash_currency_official.webp，並用影像分析算出遊戲座標 → 美術圖像素的換算（需要 Pillow、numpy）。
需要 Node.js。第一次執行會用 npm 把 pathofexile-dat 裝到 tools/_poedat_tool/（不上傳）。

用法：
    python tools/extract_stash_layout.py 3.29.3.3
每季更新腳本（update_craft_data.py）會自動呼叫；失敗時保留舊的 stash_layout_game.json。
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "stash_layout_game.json")
TOOL_DIR = os.path.join(HERE, "_poedat_tool")
ART_GAME_PATH = "art/textures/interface/2d/2dart/uiimages/ingame/mtx/currencystash/4k/backgroundbase.dds"
ART_OUT = os.path.join(HERE, "..", "img", "craft", "stash_currency_official.webp")
CUR_UNIT = 85   # 通貨頁一格的遊戲單位（XOffset 的間距）
ART_DIR = "art/textures/interface/2d/2dart/uiimages/ingame/mtx/currencystash/4k/"
# 「輿圖」「聯盟」子分頁：遊戲裡的整張背景（BackgroundAtlas）是舊版面、和 3.29 排列資料對不上，
# 所以用官方的空白底圖（CurrencyBackground）＋官方單格格框（Currency1x1Slot、CurrencyCentreSlot），
# 照 3.29 的 CurrencyStashTabLayout 擺上去（和「一般」頁同一套座標換算）。
COMPOSED_TABS = {"atlas": 1, "league": 2}
SLOT_SCALE = 0.88   # 單格框的外框大小＝一格的 88%（和「一般」頁官方整張圖上的格框一致）
TOOL = "pathofexile-dat@16.0.1"
TABLES = [
    {"name": "EssenceStashTabLayout",
     "columns": ["Id", "StoredItem", "XOffset", "YOffset", "FirstSlotIndex", "Width", "Height", "IsUpgradableEssenceSlot"]},
    {"name": "CurrencyStashTabLayout",
     "columns": ["Id", "StoredItem", "XOffset", "YOffset", "FirstSlotIndex", "Width", "Height", "ShowIfEmpty", "SlotGroup"]},
    {"name": "DelveStashTabLayout",
     "columns": ["Id", "StoredItem", "XOffset", "YOffset", "Width", "Height", "SlotSize", "HideIfEmpty"]},
    {"name": "BaseItemTypes", "columns": ["Id"]},
]
DELVE_ART = "art/textures/interface/2d/2dart/uiimages/ingame/mtx/delvestash/4k/delvetabbackground.dds"
DELVE_OUT = os.path.join(HERE, "..", "img", "craft", "stash_delve_official.webp")


def tool_cmd():
    """直接用 node 執行（不經過 cmd／npx，避免 Windows 上 PATH 的問題）"""
    node = shutil.which("node")
    if not node:
        raise RuntimeError("找不到 Node.js")
    run_js = os.path.join(TOOL_DIR, "node_modules", "pathofexile-dat", "dist", "cli", "run.js")
    if not os.path.exists(run_js):
        npm_cli = os.path.join(os.path.dirname(node), "node_modules", "npm", "bin", "npm-cli.js")
        r = subprocess.run([node, npm_cli, "install", "--prefix", TOOL_DIR, "--no-audit", "--no-fund", TOOL])
        if r.returncode != 0 or not os.path.exists(run_js):
            raise RuntimeError("安裝 pathofexile-dat 失敗")
    return [node, run_js]


def extract(patch, out=OUT):
    work = tempfile.mkdtemp(prefix="poe-stash-layout-")
    try:
        with open(os.path.join(work, "config.json"), "w", encoding="utf-8") as f:
            json.dump({"patch": patch, "translations": ["English"], "files": [], "tables": TABLES}, f)
        r = subprocess.run(tool_cmd(), cwd=work)
        if r.returncode != 0:
            raise RuntimeError("pathofexile-dat 執行失敗")
        tdir = os.path.join(work, "tables", "English")
        load = lambda n: json.load(open(os.path.join(tdir, n + ".json"), encoding="utf-8"))
        bases = load("BaseItemTypes")
        item = lambda i: None if i is None else bases[i]["Id"]

        def rows(tbl, extra):
            return [{"id": r["Id"], "item": item(r["StoredItem"]), "x": r["XOffset"], "y": r["YOffset"],
                     "w": r["Width"], "h": r["Height"], **{k: r[v] for k, v in extra.items()}} for r in load(tbl)]

        data = {
            "patch": patch,
            "source": "pathofexile-dat " + TOOL.split("@")[1] + "（官方更新伺服器）",
            "essence": rows("EssenceStashTabLayout", {}),
            "currency": rows("CurrencyStashTabLayout", {"group": "SlotGroup", "show": "ShowIfEmpty"}),
        }
        data["delve"] = [{"id": r["Id"], "item": item(r["StoredItem"]), "x": r["XOffset"], "y": r["YOffset"],
                          "w": r["Width"], "h": r["Height"], "size": r["SlotSize"], "show": not r["HideIfEmpty"]}
                         for r in load("DelveStashTabLayout")]
        try:
            data["delveArt"] = delve_art(patch, work, data["delve"])
        except Exception as e:
            print("警告：化石頁美術圖沒有更新：", e)
            if os.path.exists(out):
                old = json.load(open(out, encoding="utf-8"))
                if old.get("delveArt"):
                    data["delveArt"] = old["delveArt"]
        try:
            data["currencyArt"] = currency_art(patch, work, data["currency"])
        except Exception as e:   # 沒有 Pillow／numpy 或下載失敗：沿用舊的美術圖和換算
            print("警告：通貨頁美術圖沒有更新：", e)
            if os.path.exists(out):
                old = json.load(open(out, encoding="utf-8"))
                if old.get("currencyArt"):
                    data["currencyArt"] = old["currencyArt"]
        with open(out, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print(f"倉庫頁排列表：精髓 {len(data['essence'])} 格、通貨 {len(data['currency'])} 格、"
              f"化石 {len(data['delve'])} 格 → {out}")
        return data
    finally:
        shutil.rmtree(work, ignore_errors=True)


def currency_art(patch, work, rows):
    """取出官方美術圖、轉成 webp，並找出「遊戲座標 → 美術圖像素」的換算：
    把「一般」頁（SlotGroup 0 會顯示的格子＋SlotGroup 3）投影到圖上，找格框亮、格子內部暗最明顯的縮放和平移。"""
    import numpy as np
    from PIL import Image
    node = tool_cmd()[0]
    dds = os.path.join(work, "currency.dds")
    r = subprocess.run([node, os.path.join(HERE, "poedat_getfile.mjs"), TOOL_DIR, os.path.join(work, ".cache"),
                        patch, ART_GAME_PATH, dds])
    if r.returncode != 0:
        raise RuntimeError("取出美術圖失敗")
    im = Image.open(dds).convert("RGB")
    im.save(ART_OUT, quality=88, method=6)
    A = np.asarray(im.convert("L"), dtype=np.float64)
    H, W = A.shape
    S = np.zeros((H + 1, W + 1)); S[1:, 1:] = A.cumsum(0).cumsum(1)
    use = [x for x in rows if x["group"] == 3 or (x["group"] == 0 and x["show"])]
    X = np.array([x["x"] for x in use], float); Y = np.array([x["y"] for x in use], float)
    WW = np.array([x["w"] for x in use], float); HH = np.array([x["h"] for x in use], float)

    def mean(x0, y0, x1, y1):
        x0, x1 = (np.clip(np.round(v).astype(int), 0, W) for v in (x0, x1))
        y0, y1 = (np.clip(np.round(v).astype(int), 0, H) for v in (y0, y1))
        return (S[y1, x1] - S[y0, x1] - S[y1, x0] + S[y0, x0]) / np.maximum((x1 - x0) * (y1 - y0), 1)

    def score(k, tx, ty):
        cx = k * (X + CUR_UNIT * WW / 2) + tx; cy = k * (Y + CUR_UNIT * HH / 2) + ty
        hw = k * CUR_UNIT * WW / 2; hh = k * CUR_UNIT * HH / 2
        inner = mean(cx - hw * .7, cy - hh * .7, cx + hw * .7, cy + hh * .7)
        outer = mean(cx - hw, cy - hh, cx + hw, cy + hh)
        return float(np.mean(outer / .51 - inner))

    best = max(((score(k, tx, ty), k, tx, ty) for k in np.arange(W / 1100, W / 800, .005)
                for tx in range(-80, 40, 2) for ty in range(-80, 40, 2)))
    _, k, tx, ty = best
    best = max(((score(k2, tx2, ty2), k2, tx2, ty2) for k2 in np.arange(k - .006, k + .006, .001)
                for tx2 in np.arange(tx - 2, tx + 2.1, .5) for ty2 in np.arange(ty - 2, ty + 2.1, .5)))
    _, k, tx, ty = best
    print(f"通貨頁美術圖：{W}×{H}，換算 像素 = {k:.4f} × 遊戲座標 + ({tx:.1f}, {ty:.1f}) → {os.path.abspath(ART_OUT)}")
    tabs = {"general": {"file": "stash_currency_official.webp", "group": 0, "composed": False}}
    tabs.update(compose_tabs(patch, work, rows, (W, H), float(k), float(tx), float(ty)))
    return {"file": "stash_currency_official.webp", "game": ART_GAME_PATH, "w": W, "h": H,
            "k": round(float(k), 4), "tx": float(tx), "ty": float(ty), "unit": CUR_UNIT, "tabs": tabs}


def delve_art(patch, work, rows):
    """化石頁（DelveStashTabLayout）：官方背景圖 DelveTabBackground，存成 stash_delve_official.webp，
    並算出「遊戲座標 → 圖上像素」的換算。格子裡印著明亮的化石圖示，不能用「格子內部比較暗」判斷，
    改看格框那一圈細亮線：框線那一圈亮度 ×2 − 框線內外兩側的亮度，越大越好。"""
    import numpy as np
    from PIL import Image
    node = tool_cmd()[0]
    dds = os.path.join(work, "delve.dds")
    if subprocess.run([node, os.path.join(HERE, "poedat_getfile.mjs"), TOOL_DIR, os.path.join(work, ".cache"),
                       patch, DELVE_ART, dds]).returncode != 0:
        raise RuntimeError("取出化石頁美術圖失敗")
    im = Image.open(dds).convert("RGB")
    im.save(DELVE_OUT, quality=88, method=6)
    A = np.asarray(im.convert("L"), dtype=np.float64)
    H, W = A.shape
    S = np.zeros((H + 1, W + 1)); S[1:, 1:] = A.cumsum(0).cumsum(1)
    use = [r for r in rows if r["show"]]
    X = np.array([r["x"] for r in use], float); Y = np.array([r["y"] for r in use], float)
    RW = np.array([r["w"] * r["size"] for r in use], float); RH = np.array([r["h"] * r["size"] for r in use], float)

    def box(x0, y0, x1, y1):
        x0, x1 = (np.clip(np.round(v).astype(int), 0, W) for v in (x0, x1))
        y0, y1 = (np.clip(np.round(v).astype(int), 0, H) for v in (y0, y1))
        return S[y1, x1] - S[y0, x1] - S[y1, x0] + S[y0, x0], np.maximum((x1 - x0) * (y1 - y0), 1)

    def ring(k, tx, ty, a, b):
        cx = k * (X + RW / 2) + tx; cy = k * (Y + RH / 2) + ty; hw = k * RW / 2; hh = k * RH / 2
        s1, n1 = box(cx - hw * b, cy - hh * b, cx + hw * b, cy + hh * b)
        s0, n0 = box(cx - hw * a, cy - hh * a, cx + hw * a, cy + hh * a)
        return (s1 - s0) / np.maximum(n1 - n0, 1)

    def score(k, tx, ty):
        return float(np.mean(2 * ring(k, tx, ty, .96, 1.04) - ring(k, tx, ty, .84, .92) - ring(k, tx, ty, 1.08, 1.16)))

    # 倉庫頁美術圖的比例都在 1.35 左右（通貨頁 1.348），在附近找
    best = max(((score(k, tx, ty), k, tx, ty) for k in np.arange(1.30, 1.40, .002)
                for tx in range(-40, 41) for ty in range(-40, 41)))
    _, k, tx, ty = best
    print(f"化石頁美術圖：{W}×{H}，換算 像素 = {k:.4f} × 遊戲座標 + ({tx:.1f}, {ty:.1f}) → {os.path.abspath(DELVE_OUT)}")
    return {"file": "stash_delve_official.webp", "game": DELVE_ART, "w": W, "h": H,
            "k": round(float(k), 4), "tx": float(tx), "ty": float(ty)}


def compose_tabs(patch, work, rows, size, k, tx, ty):
    """「輿圖」「聯盟」：空白底圖＋單格格框，照排列資料擺（ShowIfEmpty＝否的格子不畫框）。"""
    from PIL import Image
    node = tool_cmd()[0]
    get = lambda path, out: subprocess.run([node, os.path.join(HERE, "poedat_getfile.mjs"), TOOL_DIR,
                                            os.path.join(work, ".cache"), patch, path, out]).returncode == 0
    sheet, blank = os.path.join(work, "cur_sheet.dds"), os.path.join(work, "cur_blank.dds")
    if not (get(ART_DIR + "1.dds", sheet) and get(ART_DIR + "currencybackground.dds", blank)):
        raise RuntimeError("取出通貨頁空白底圖／格框失敗")
    sh = Image.open(sheet).convert("RGBA")
    # 切割表 art/uiimages1.txt：MTX/CurrencyStash/4K/Currency1x1Slot、CurrencyCentreSlot
    slot, centre = sh.crop((1538, 0, 1673, 135)), sh.crop((1273, 0, 1529, 431))
    out = {}
    for name, g in COMPOSED_TABS.items():
        bg = Image.open(blank).convert("RGBA").crop((0, 0, 1264, 1264)).resize(size)
        for r in rows:
            if r["group"] not in (g, 3) or (r["group"] == g and not r["show"]):
                continue
            cx = k * (r["x"] + CUR_UNIT * r["w"] / 2) + tx
            cy = k * (r["y"] + CUR_UNIT * r["h"] / 2) + ty
            src = centre if r["w"] > 1 else slot
            s = k * CUR_UNIT * r["w"] * (1.0 if r["w"] > 1 else SLOT_SCALE) / src.width * (1.06 if r["w"] > 1 else 1)
            im = src.resize((max(1, round(src.width * s)), max(1, round(src.height * s))))
            bg.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))
        fn = f"stash_currency_{name}.webp"
        bg.convert("RGB").save(os.path.join(os.path.dirname(ART_OUT), fn), quality=88, method=6)
        out[name] = {"file": fn, "group": g, "composed": True}
        print(f"通貨頁「{name}」：空白底圖＋官方格框，照排列資料組成 → {fn}")
    return out


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        print("用法：python tools/extract_stash_layout.py <patch 版本，例如 3.29.3.3>")
        sys.exit(1)
    extract(sys.argv[1])

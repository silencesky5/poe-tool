"""
產生 craft-data.js（製裝模擬器用的底材 / 詞綴 / 詞綴文字資料）。

用法（在專案根目錄或任何地方都可以）：
    python tools/build_craft_data.py
    python tools/build_craft_data.py --src 已下載的資料夾   # 不重新下載

資料來源：RePoE fork（PoE1）https://repoe-fork.github.io/
只保留第一版會用到的內容：武器、護甲、飾品的一般底材，以及能出現在這些底材上的
item 前綴 / 後綴。詳細說明見 tools/README-craft.md。
另外下載繁中版的 stat_translations.json、base_items.json、mods.json，加上詞綴中文模板、底材中文名、
詞綴中文名稱（英文保留）。

圖示：底材和 10 顆通貨的官方圖下載到 img/craft/items/（網站只讀本地檔）。
    已經下載過的檔案會跳過；--no-icons 不下載圖示。
    網址規則：https://web.poecdn.com/image/ ＋ visual_identity.dds_file（副檔名換成 .png）。
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date

BASE_URL = "https://repoe-fork.github.io/"
FILES = ["mods.json", "base_items.json", "stat_translations.json", "essences.json", "crafting_bench_options.json",
         "version.txt"]
# 遊戲繁中版匯出的資料（結構和英文版一樣）：詞綴的中文模板、底材中文名、詞綴中文名稱
ZH_DIR = "Traditional Chinese/"
ZH_FILES = ["stat_translations.json", "base_items.json", "mods.json", "essences.json"]
ICON_URL = "https://web.poecdn.com/image/"
ICON_MAX_MB = 30  # 超過就停下來，不要默默塞一大堆圖進網站

# 模擬器用到的 10 顆通貨（鍵值和 craft-engine.js 的 CURRENCIES 一樣）
CURRENCY_BASES = {
    "transmute": "Metadata/Items/Currency/CurrencyUpgradeToMagic",
    "alt": "Metadata/Items/Currency/CurrencyRerollMagic",
    "aug": "Metadata/Items/Currency/CurrencyAddModToMagic",
    "regal": "Metadata/Items/Currency/CurrencyUpgradeMagicToRare",
    "alch": "Metadata/Items/Currency/CurrencyUpgradeToRare",
    "chaos": "Metadata/Items/Currency/CurrencyRerollRare",
    "exalt": "Metadata/Items/Currency/CurrencyAddModToRare",
    "divine": "Metadata/Items/Currency/CurrencyModValues",
    "annul": "Metadata/Items/Currency/CurrencyRemoveMod",
    "scour": "Metadata/Items/Currency/CurrencyConvertToNormal",
}

# 製裝台通貨頁的擺設（模擬器還不支援，只放圖示）。
# 之後某顆做成可用時，把它搬到上面的 CURRENCY_BASES，並在 craft-bench.js 從 DECOR_SLOT 搬到 CURRENCY_SLOT。
# 機會石、瓦爾寶珠：Kalandralang 沒有實作，規則先不做。
DECOR_BASES = {
    "scrollfrag": "Metadata/Items/Currency/CurrencyIdentificationShard",
    "wisdom": "Metadata/Items/Currency/CurrencyIdentification",
    "portal": "Metadata/Items/Currency/CurrencyPortal",
    "whetstone": "Metadata/Items/Currency/CurrencyWeaponQuality",
    "scrap": "Metadata/Items/Currency/CurrencyArmourQuality",
    "bauble": "Metadata/Items/Currency/CurrencyFlaskQuality",
    "gcp": "Metadata/Items/Currency/CurrencyGemQuality",
    "chance": "Metadata/Items/Currency/CurrencyUpgradeRandomly",
    "mirror": "Metadata/Items/Currency/CurrencyDuplicate",
    "blessed": "Metadata/Items/Currency/CurrencyRerollImplicit",
    "transshard": "Metadata/Items/Currency/CurrencyUpgradeToMagicShard",
    "altshard": "Metadata/Items/Currency/CurrencyRerollMagicShard",
    "chaosshard": "Metadata/Items/Currency/CurrencyRerollRareShard",
    "mirrorshard": "Metadata/Items/Currency/CurrencyDuplicateShard",
    "exaltshard": "Metadata/Items/Currency/CurrencyAddModToRareShard",
    "alchshard": "Metadata/Items/Currency/CurrencyUpgradeToRareShard",
    "regalshard": "Metadata/Items/Currency/CurrencyUpgradeMagicToRareShard",
    "annulshard": "Metadata/Items/Currency/CurrencyRemoveModShard",
    "jeweller": "Metadata/Items/Currency/CurrencyRerollSocketNumbers",
    "fusing": "Metadata/Items/Currency/CurrencyRerollSocketLinks",
    "chrom": "Metadata/Items/Currency/CurrencyRerollSocketColours",
    "sacred": "Metadata/Items/Currency/CurrencyRerollDefences",
    "deck": "Metadata/Items/DivinationCards/DivinationCardDeck",
    "vaal": "Metadata/Items/Currency/CurrencyCorrupt",
    "fracture": "Metadata/Items/Currency/CurrencyFractureRare",
    "fractureshard": "Metadata/Items/Currency/CurrencyFractureRareShard",
    "binding": "Metadata/Items/Currency/CurrencyUpgradeToRareAndSetSockets",
    "regret": "Metadata/Items/Currency/CurrencyPassiveRefund",
    "unmaking": "Metadata/Items/Currency/CurrencyAtlasPassiveRefund",
}

# 物品類別 → (大類, 中文)
CLASSES = {
    # 武器
    "Bow": ("weapon", "弓"),
    "Claw": ("weapon", "爪"),
    "Dagger": ("weapon", "匕首"),
    "Rune Dagger": ("weapon", "符文匕首"),
    "One Hand Axe": ("weapon", "單手斧"),
    "One Hand Mace": ("weapon", "單手錘"),
    "One Hand Sword": ("weapon", "單手劍"),
    "Thrusting One Hand Sword": ("weapon", "細劍"),
    "Sceptre": ("weapon", "權杖"),
    "Wand": ("weapon", "法杖"),
    "Staff": ("weapon", "長杖"),
    "Warstaff": ("weapon", "戰杖"),
    "Two Hand Axe": ("weapon", "雙手斧"),
    "Two Hand Mace": ("weapon", "雙手錘"),
    "Two Hand Sword": ("weapon", "雙手劍"),
    # 護甲
    "Helmet": ("armour", "頭盔"),
    "Body Armour": ("armour", "胸甲"),
    "Gloves": ("armour", "手套"),
    "Boots": ("armour", "鞋子"),
    "Shield": ("armour", "盾"),
    # 飾品
    "Ring": ("jewellery", "戒指"),
    "Amulet": ("jewellery", "項鍊"),
    "Belt": ("jewellery", "腰帶"),
}
# 不是一般底材的（掉落即汙染的護身符、活動用道具等）
EXCLUDE_TAGS = {"talisman", "demigods", "not_for_sale"}

# 有實作的數值換算（index_handlers）。腳本遇到不在這裡的會印警告。
KNOWN_HANDLERS = {
    "negate", "divide_by_one_hundred", "divide_by_one_hundred_2dp", "divide_by_one_hundred_2dp_if_required",
    "milliseconds_to_seconds", "milliseconds_to_seconds_0dp", "milliseconds_to_seconds_1dp",
    "milliseconds_to_seconds_2dp", "milliseconds_to_seconds_2dp_if_required",
    "per_minute_to_per_second", "per_minute_to_per_second_0dp", "per_minute_to_per_second_1dp",
    "per_minute_to_per_second_2dp", "per_minute_to_per_second_2dp_if_required",
    "divide_by_ten_0dp", "divide_by_ten_1dp", "divide_by_ten_1dp_if_required",
    "locations_to_metres", "double", "negate_and_double", "times_twenty", "times_one_point_five",
    "divide_by_two_0dp", "divide_by_five", "divide_by_six", "divide_by_twelve", "divide_by_one_thousand",
    "deciseconds_to_seconds", "30%_of_value", "60%_of_value", "old_leech_percent", "old_leech_permyriad",
    "permyriad_per_minute_to_%_per_second", "canonical_stat",
}


def fetch(src):
    if src:
        return src
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_repoe_cache")
    os.makedirs(out, exist_ok=True)
    jobs = [(f, f) for f in FILES] + [(ZH_DIR + f, zh_name(f)) for f in ZH_FILES]
    for remote, local in jobs:
        url = BASE_URL + urllib.parse.quote(remote)
        print("下載", url)
        with urllib.request.urlopen(url) as r, open(os.path.join(out, local), "wb") as w:
            w.write(r.read())
    return out


def zh_name(f):
    """繁中檔案在本機的檔名：stat_translations.json → zh_stat_translations.json"""
    return "zh_" + f


def load(src, name):
    with open(os.path.join(src, name), encoding="utf-8") as f:
        return json.load(f)


def legacy_v2():
    """存檔 v2（記編號）當時的底材、詞綴順序（tools/legacy_v2_index.json，固定不變），讀到舊存檔時用來轉成 id。"""
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "legacy_v2_index.json")
    with open(p, encoding="utf-8") as f:
        j = json.load(f)
    return {"b": j["bases"], "m": j["mods"]}


def align_slots(game, slots):
    """把遊戲倉庫頁的格子（左上角座標＋寬高，遊戲單位）對到背景圖的格子（stash_layouts.json，像素）。
    比例＝兩邊最常見的水平格距之比；平移試遍所有「遊戲格 → 圖上格」的配對，選對上最多格的。
    回傳 {遊戲格 id: 圖上格 i}、對上的格數。"""
    def gap(xs):
        xs = sorted(set(round(x) for x in xs))
        d = {}
        for a, b in zip(xs, xs[1:]):
            v = round((b - a) / 2) * 2
            if v > 20:
                d[v] = d.get(v, 0) + 1
        return max(d.items(), key=lambda kv: kv[1])[0]
    unit = gap([r["x"] for r in game])
    pts = [(r["x"] + r["w"] * unit / 2, r["y"] + r["h"] * unit / 2) for r in game]
    img = [(s["x"] + s["w"] / 2, s["y"] + s["h"] / 2) for s in slots]
    k = gap([p[0] for p in img]) / unit
    tol = gap([p[0] for p in img]) * 0.3

    def nearest(x, y):
        return min(((abs(px - x) + abs(py - y), i) for i, (px, py) in enumerate(img)))

    best = None
    for gx, gy in pts:
        for ix, iy in img:
            tx, ty = ix - k * gx, iy - k * gy
            n = sum(1 for (px, py) in pts if nearest(k * px + tx, k * py + ty)[0] < tol)
            if not best or n > best[0]:
                best = (n, tx, ty)
    _, tx, ty = best
    out = {}
    for r, (px, py) in zip(game, pts):
        d, i = nearest(k * px + tx, k * py + ty)
        if d < tol and i not in out.values():
            out[r["id"]] = slots[i]["i"]
    return out, len(out)


def essence_tab(here, essence_ids):
    """精髓倉庫頁：官方排列表（tools/stash_layout_game.json，extract_stash_layout.py 產生）對到背景圖 stash_page_D。
    對不齊（例如新賽季多了精髓、背景圖還沒換）時印警告並回傳 None（網頁改用依序排列）。"""
    gp = os.path.join(here, "stash_layout_game.json")
    lp = os.path.join(here, "..", "img", "craft", "stash_layouts.json")
    if not (os.path.exists(gp) and os.path.exists(lp)):
        print("警告：沒有倉庫頁排列表，精髓頁改用依序排列")
        return None
    game = json.load(open(gp, encoding="utf-8"))
    page = json.load(open(lp, encoding="utf-8"))["stash_page_D"]
    m, n = align_slots(game["essence"], page["slots"])
    if n != len(game["essence"]):
        print(f"警告：精髓頁排列表只對上 {n}/{len(game['essence'])} 格，改用依序排列")
        return None
    slots = {r["item"]: m[r["id"]] for r in game["essence"] if r["item"]}
    generic = [m[r["id"]] for r in game["essence"] if not r["item"] and r["w"] == 1]
    missing = [e for e in essence_ids if e not in slots]
    print(f"精髓頁：官方排列 {len(slots)} 種精髓、通用格 {len(generic)} 個（{game['patch']}）"
          + (f"；排列表裡沒有的精髓：{missing}" if missing else ""))
    return {"slots": slots, "generic": generic, "patch": game["patch"]}


def currency_tab(here, bases_raw, zh_bases, cur_key, decor, icon_jobs):
    """通貨頁「一般」：官方 3.29 美術圖（stash_currency_official.webp）＋ CurrencyStashTabLayout 的格子
    （SlotGroup 0 的通貨格＋SlotGroup 3 的大格和通用格）。座標換算由 extract_stash_layout.py 算好。
    版面上的物品不在模擬器通貨／擺設清單裡的，自動加成擺設（鍵值 "x:" ＋ Metadata 最後一段）。
    hide：ShowIfEmpty＝否的格子（倉庫裡有這個物品才顯示）。"""
    gp = os.path.join(here, "stash_layout_game.json")
    if not os.path.exists(gp):
        print("警告：沒有倉庫頁排列表，通貨頁沒有格子資料")
        return None
    game = json.load(open(gp, encoding="utf-8"))
    art = game.get("currencyArt")
    if not art or not os.path.exists(os.path.join(here, "..", "img", "craft", art["file"])):
        print("警告：沒有通貨頁官方美術圖，通貨頁沒有格子資料")
        return None
    k, tx, ty, u = art["k"], art["tx"], art["ty"], art["unit"]
    inset = 0.08   # 格框內側（圖示放在框裡面）
    slots, added = [], 0
    for r in game["currency"]:
        if r["group"] not in (0, 3):
            continue
        key = None
        if r["item"]:
            key = cur_key.get(r["item"])
            if not key:
                key = "x:" + r["item"].split("/")[-1]
                b = bases_raw.get(r["item"]) or {}
                dds = (b.get("visual_identity") or {}).get("dds_file")
                if key not in decor and b and dds:
                    decor[key] = {"en": b["name"], "zh": (zh_bases.get(r["item"]) or {}).get("name") or b["name"],
                                  "ic": icon_name(dds)}
                    icon_jobs[decor[key]["ic"]] = dds
                    added += 1
            if key not in decor and key not in CURRENCY_BASES:
                key = None
        ip = k * u * inset
        slots.append({"k": key, "x": round(k * r["x"] + tx + ip, 1), "y": round(k * r["y"] + ty + ip, 1),
                      "w": round(k * u * r["w"] - 2 * ip, 1), "h": round(k * u * r["h"] - 2 * ip, 1),
                      "hide": bool(r["group"] == 0 and not r["show"]),
                      "kind": "item" if r["item"] else ("craft" if r["id"] == "CraftingSlot" else "generic")})
    print(f"通貨頁：官方美術圖 {art['w']}×{art['h']}、格子 {len(slots)} 個（隱藏格 {sum(s['hide'] for s in slots)}），"
          f"新增擺設通貨 {added} 種（{game['patch']}）")
    return {"bg": art["file"], "w": art["w"], "h": art["h"], "patch": game["patch"], "slots": slots}


def bench_ui(here):
    """工藝台介面：官方美術圖清單和物品類別分頁（img/craft/ui/manifest.json，extract_ui_art.py 產生）。
    分頁只留包含模擬器物品類別的。"""
    p = os.path.join(here, "..", "img", "craft", "ui", "manifest.json")
    if not os.path.exists(p):
        print("警告：沒有工藝台介面美術圖，網頁改用 CSS")
        return None
    m = json.load(open(p, encoding="utf-8"))
    tabs = [{"code": t["code"], "zh": t["zh"], "en": t["en"], "classes": [c for c in t["classes"] if c in CLASSES]}
            for t in m.get("benchTabs", [])]
    tabs = [t for t in tabs if t["classes"]]
    art = {k: [v["w"], v["h"]] for k, v in m.get("found", {}).items()}
    print(f"工藝台介面：美術圖 {len(art)} 個、物品類別分頁 {len(tabs)} 個（{m.get('patch')}）")
    return {"tabs": tabs, "art": art, "patch": m.get("patch")}


def first_weight(spawn_weights, tags):
    """依列表順序取第一個底材也有的 tag 的權重（Kalandralang 的規則）。"""
    for sw in spawn_weights:
        if sw["tag"] in tags:
            return sw["weight"]
    return None


def icon_name(dds):
    """Art/2DItems/Armours/Helmets/HelmetInt11.dds → Armours_Helmets_HelmetInt11.png"""
    p = dds[len("Art/2DItems/"):] if dds.startswith("Art/2DItems/") else dds
    return os.path.splitext(p)[0].replace("/", "_") + ".png"


def download_icons(jobs, out_dir):
    """jobs：{檔名: dds 路徑}。已存在的跳過；回傳 (成功數, 失敗清單, 總大小)。超過 ICON_MAX_MB 就停。"""
    os.makedirs(out_dir, exist_ok=True)
    ok, failed, total = 0, [], 0
    for name, dds in sorted(jobs.items()):
        path = os.path.join(out_dir, name)
        if not os.path.exists(path):
            url = ICON_URL + os.path.splitext(dds)[0] + ".png"
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    data = r.read()
                if not data.startswith(b"\x89PNG"):
                    raise ValueError("不是 PNG")
                with open(path, "wb") as w:
                    w.write(data)
            except Exception as e:  # 下載失敗：網站會改畫灰色方框
                failed.append(f"{name}（{e}）")
                continue
        ok += 1
        total += os.path.getsize(path)
        if total > ICON_MAX_MB * 1024 * 1024:
            print(f"錯誤：圖示總大小超過 {ICON_MAX_MB} MB，先停下來（已下載 {ok} 張）")
            sys.exit(1)
    return ok, failed, total


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="已下載 RePoE 檔案的資料夾（省略就重新下載）")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "craft-data.js"))
    ap.add_argument("--no-icons", action="store_true", help="不下載圖示")
    a = ap.parse_args()

    src = fetch(a.src)
    version = open(os.path.join(src, "version.txt"), encoding="utf-8").read().strip() \
        if os.path.exists(os.path.join(src, "version.txt")) else "unknown"
    mods = load(src, "mods.json")
    bases_raw = load(src, "base_items.json")
    trans = load(src, "stat_translations.json")
    zh_trans = load(src, zh_name("stat_translations.json"))
    zh_bases = load(src, zh_name("base_items.json"))
    zh_mods = load(src, zh_name("mods.json"))
    essences_raw = load(src, "essences.json")
    bench_raw = load(src, "crafting_bench_options.json")
    zh_essences = load(src, zh_name("essences.json"))
    zh_by_ids = {tuple(e["ids"]): e.get("Traditional Chinese") for e in zh_trans}

    # ── 底材 ──
    bases = []
    for bid, b in bases_raw.items():
        if b["item_class"] not in CLASSES or b["domain"] != "item" or b.get("release_state") != "released":
            continue
        if EXCLUDE_TAGS & set(b["tags"]) or "Royale" in bid:
            continue
        bases.append((bid, b))
    bases.sort(key=lambda x: (list(CLASSES).index(x[1]["item_class"]), x[1]["drop_level"], x[1]["name"]))

    # ── 詞綴：item domain 的前後綴，至少能在一個底材上以 >0 權重出現 ──
    keep = {}
    base_tagsets = [set(b["tags"]) for _, b in bases]
    for mid, m in mods.items():
        if m["domain"] != "item" or m["generation_type"] not in ("prefix", "suffix"):
            continue
        if "Royale" in mid:  # 大逃殺活動專用，正式聯盟不會出現
            continue
        ok = False
        for ts in base_tagsets:
            w = first_weight(m["spawn_weights"], ts)
            if w and w > 0:
                g = first_weight(m["generation_weights"], ts)
                if g is None or w * g // 100 > 0:
                    ok = True
                    break
        if ok:
            keep[mid] = m

    # 精髓保證的詞綴：一般詞綴池抽不到的（權重 0）另外收進來，標記 d = "e"，只會從精髓出現
    # 工藝台詞綴（domain crafted，含元工藝）：標記 d = "c"，只會從工藝台出現
    special = {}
    for o in bench_raw:
        mid = (o.get("actions") or {}).get("add_explicit_mod")
        if mid and mid in mods and set(o.get("item_classes") or []) & set(CLASSES):
            keep[mid] = mods[mid]
            special[mid] = "c"
    for e in essences_raw.values():
        for mid in (e.get("mods") or {}).values():
            if mid and mid not in keep and mid in mods:
                keep[mid] = mods[mid]
                special[mid] = "e"

    # tag 字串集中成一張表，省空間
    tag_list, tag_idx = [], {}

    def T(t):
        if t not in tag_idx:
            tag_idx[t] = len(tag_list)
            tag_list.append(t)
        return tag_idx[t]

    # 隱含詞綴（底材固有）的文字；中文版用 stats 的範圍在網頁上套中文模板
    def implicit_mods(b):
        return [mods[i] for i in b["implicits"] if i in mods and mods[i].get("text")]

    # 存檔用底材的 id（Metadata 路徑）和詞綴 id 記錄，不用編號；網頁內部仍用編號，新欄位一律往後加
    out_bases, icon_jobs, missing_base = [], {}, []
    for bid, b in bases:
        dds = (b.get("visual_identity") or {}).get("dds_file") or ""
        ic = icon_name(dds) if dds else ""
        if ic:
            icon_jobs[ic] = dds
        imps = implicit_mods(b)
        zh_n = (zh_bases.get(bid) or {}).get("name")
        if not zh_n or zh_n == b["name"]:
            missing_base.append(b["name"])
        out_bases.append({
            "id": bid,                            # Metadata/Items/…：存檔用這個
            "n": b["name"],
            "c": b["item_class"],
            "lv": b["drop_level"],
            "t": [T(t) for t in b["tags"]],
            "imp": [m["text"] for m in imps],
            "w": b.get("inventory_width") or 1,   # 佔格大小
            "h": b.get("inventory_height") or 1,
            "ic": ic,                             # img/craft/items/ 底下的圖檔名
            "nz": zh_n or b["name"],              # 繁中名稱（沒有就用英文）
            "is": [[[s["id"], s["min"], s["max"]] for s in m["stats"]] for m in imps],  # 固有詞綴的數值範圍
        })

    # 通貨圖示
    cur_icons = {}
    for k, bid in CURRENCY_BASES.items():
        dds = (bases_raw.get(bid, {}).get("visual_identity") or {}).get("dds_file")
        if not dds:
            print("警告：找不到通貨圖示", k, bid)
            continue
        cur_icons[k] = icon_name(dds)
        icon_jobs[cur_icons[k]] = dds

    # 擺設用通貨：英文名、繁中名、圖示
    decor = {}
    for k, bid in DECOR_BASES.items():
        b = bases_raw.get(bid)
        dds = ((b or {}).get("visual_identity") or {}).get("dds_file")
        if not b or not dds:
            print("警告：找不到擺設通貨", k, bid)
            continue
        decor[k] = {"en": b["name"], "zh": (zh_bases.get(bid) or {}).get("name") or b["name"], "ic": icon_name(dds)}
        icon_jobs[decor[k]["ic"]] = dds

    # ── 詞綴文字（只留用得到的 stat id）──
    used_stats = {s["id"] for m in keep.values() for s in m["stats"]}
    used_stats |= {s[0] for b in out_bases for st in b["is"] for s in st}
    out_trans, stat_to_tr, unknown = [], {}, set()
    missing_zh = []   # 有英文、沒有中文的 stat id

    def variants_of(vs):
        out = []
        for v in vs:
            for hs in v["index_handlers"]:
                for h in hs:
                    if h not in KNOWN_HANDLERS:
                        unknown.add(h)
            out.append({
                "c": [[c.get("min"), c.get("max"), 1 if c.get("negated") else 0] for c in v["condition"]],
                "f": v["format"],
                "h": v["index_handlers"],
                "s": v["string"],
            })
        return out

    for e in trans:
        if e.get("hidden") or not (set(e["ids"]) & used_stats):
            continue
        entry = {"ids": e["ids"], "v": variants_of(e["English"])}
        zh = zh_by_ids.get(tuple(e["ids"]))
        if zh:
            entry["z"] = variants_of(zh)   # 中文模板：選哪一條、數值怎麼換算都和英文一樣
        else:
            missing_zh.extend(sorted(set(e["ids"]) & used_stats))
        idx = len(out_trans)
        out_trans.append(entry)
        for sid in e["ids"]:
            stat_to_tr.setdefault(sid, idx)

    out_mods, missing_mod_zh = [], []
    for mid, m in sorted(keep.items()):
        zh_mn = (zh_mods.get(mid) or {}).get("name")
        if not zh_mn or zh_mn == m["name"]:
            missing_mod_zh.append(mid)
        out_mods.append({
            "id": mid,
            "n": m["name"],
            "g": "p" if m["generation_type"] == "prefix" else "s",
            "gr": m["groups"],
            "ty": m["type"],
            "lv": m["required_level"],
            "sw": [[T(x["tag"]), x["weight"]] for x in m["spawn_weights"]],
            "gw": [[T(x["tag"]), x["weight"]] for x in m["generation_weights"]],
            "at": [T(t) for t in m["adds_tags"]],
            "tg": m["implicit_tags"],
            "st": [[s["id"], s["min"], s["max"]] for s in m["stats"]],
            "tx": m.get("text") or "",
            "nz": zh_mn or m["name"],             # 繁中詞綴名稱（沒有就用英文）
        })
        if mid in special:
            out_mods[-1]["d"] = special[mid]      # 不在一般詞綴池："e" 精髓專屬、"c" 工藝台
    mod_index = {m["id"]: i for i, m in enumerate(out_mods)}

    # ── 工藝台選項：加詞綴、移除工藝詞綴、3.29 新增的重抽詞綴（規則待確認，只列出不模擬）──
    # 插槽、連線、顏色、附魔、重骰稀有度：模擬器沒有插槽／附魔／機會石，不收。
    cur_key = {v: k for k, v in {**CURRENCY_BASES, **DECOR_BASES}.items()}
    out_bench, bench_cost_missing = [], set()
    for o in bench_raw:
        act = o.get("actions") or {}
        cls = [c for c in (o.get("item_classes") or []) if c in CLASSES]
        if not cls:
            continue
        if act.get("add_explicit_mod") in mod_index:
            entry = {"k": act["add_explicit_mod"], "a": "add", "m": mod_index[act["add_explicit_mod"]]}
        elif act.get("remove_crafted_mods"):
            entry = {"k": "remove_crafted", "a": "remove"}
        elif act.get("reroll_rare_mods"):
            entry = {"k": "reroll_rare_" + str(act["reroll_rare_mods"]), "a": "reroll", "n": act["reroll_rare_mods"]}
        else:
            continue
        cost = {}
        for cid, n in (o.get("cost") or {}).items():
            if cid in cur_key:
                cost[cur_key[cid]] = n
            else:
                bench_cost_missing.add(cid)
        entry.update({"c": cost, "cls": cls, "t": o.get("bench_tier")})
        out_bench.append(entry)

    # ── 精髓（遺忘的污染器皿沒有詞綴、3.27 起已移除，不收）──
    out_ess = []
    for eid, e in essences_raw.items():
        emods = {c: mod_index[mid] for c, mid in (e.get("mods") or {}).items() if mid and mid in mod_index}
        if not emods:
            continue
        b = bases_raw.get(eid) or {}
        dds = (b.get("visual_identity") or {}).get("dds_file") or ""
        ic = icon_name(dds) if dds else ""
        if ic:
            icon_jobs[ic] = dds
        out_ess.append({
            "id": eid,
            "n": e["name"],
            "nz": (zh_essences.get(eid) or {}).get("name") or e["name"],
            "lv": e["level"],                                 # 1 低語 … 7 破空、8 腐化精髓、0 荒蕪精髓
            "ilr": e.get("item_level_restriction"),           # 其他隨機詞綴的最高等級（低階精髓）
            "corr": bool((e.get("type") or {}).get("is_corruption_only")),
            "m": emods,                                       # 物品類別 → 保證詞綴（編號）
            "ic": ic,
        })

    data = {
        "version": version,
        "built": date.today().isoformat(),
        "source": BASE_URL,
        "classes": {k: {"group": v[0], "zh": v[1]} for k, v in CLASSES.items()},
        "tags": tag_list,
        "bases": out_bases,
        "curIcons": cur_icons,
        "decor": decor,
        "mods": out_mods,
        "essences": out_ess,
        "essTab": essence_tab(os.path.dirname(os.path.abspath(__file__)), [e["id"] for e in out_ess]),
        "benchUI": bench_ui(os.path.dirname(os.path.abspath(__file__))),
        "curTab": currency_tab(os.path.dirname(os.path.abspath(__file__)), bases_raw, zh_bases,
                               {v: k for k, v in {**CURRENCY_BASES, **DECOR_BASES}.items()}, decor, icon_jobs),
        "bench": out_bench,
        "v2": legacy_v2(),
        "trans": out_trans,
        "statTr": stat_to_tr,
    }
    js = ("/* 自動產生，請勿手改。來源：RePoE (PoE1) " + BASE_URL + "，遊戲版本 " + version +
          "。重新產生：python tools/build_craft_data.py */\n"
          "window.CRAFT_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)
    size = os.path.getsize(a.out)
    print(f"版本 {version}：底材 {len(out_bases)}、詞綴 {len(out_mods)}、文字 {len(out_trans)}，"
          f"輸出 {os.path.abspath(a.out)}（{size/1024/1024:.2f} MB）")
    if unknown:
        print("警告：有未實作的數值換算 →", sorted(unknown))
    print(f"繁中：用到的 stat {len(used_stats)} 條，沒有中文 {len(missing_zh)} 條（會顯示英文）"
          + ("" if not missing_zh else "，前 20 個：" + ", ".join(missing_zh[:20])))
    print(f"繁中：底材 {len(out_bases)} 個，沒有中文名 {len(missing_base)} 個"
          + ("" if not missing_base else "：" + ", ".join(missing_base[:20])))
    print(f"工藝台選項 {len(out_bench)} 個（加詞綴 {sum(1 for b in out_bench if b['a'] == 'add')}）"
          + (f"；費用裡有不認得的通貨：{sorted(bench_cost_missing)}" if bench_cost_missing else ""))
    print(f"精髓 {len(out_ess)} 種、精髓／工藝專屬詞綴 {len(special)} 條；沒有中文名稱的精髓 "
          f"{sum(1 for e in out_ess if e['nz'] == e['n'])} 種")
    print(f"繁中：詞綴 {len(out_mods)} 條，沒有中文名稱 {len(missing_mod_zh)} 條"
          + ("" if not missing_mod_zh else "：" + ", ".join(missing_mod_zh[:20])))
    if size > 3 * 1024 * 1024:
        print("錯誤：超過 3 MB")
        sys.exit(1)

    if not a.no_icons:
        icon_dir = os.path.join(os.path.dirname(os.path.abspath(a.out)), "img", "craft", "items")
        ok, failed, total = download_icons(icon_jobs, icon_dir)
        print(f"圖示：{ok}/{len(icon_jobs)} 張，共 {total/1024/1024:.2f} MB → {icon_dir}")
        for f in failed:
            print("  下載失敗（網站會用灰色方框代替）：", f)


if __name__ == "__main__":
    main()

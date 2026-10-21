"""
產生 craft-data.js（製裝模擬器用的底材 / 詞綴 / 詞綴文字資料）。

用法（在專案根目錄或任何地方都可以）：
    python tools/build_craft_data.py
    python tools/build_craft_data.py --src 已下載的資料夾   # 不重新下載

資料來源：RePoE fork（PoE1）https://repoe-fork.github.io/
只保留第一版會用到的內容：武器、護甲、飾品的一般底材，以及能出現在這些底材上的
item 前綴 / 後綴。詳細說明見 tools/README-craft.md。

圖示：底材和 10 顆通貨的官方圖下載到 img/craft/items/（網站只讀本地檔）。
    已經下載過的檔案會跳過；--no-icons 不下載圖示。
    網址規則：https://web.poecdn.com/image/ ＋ visual_identity.dds_file（副檔名換成 .png）。
"""
import argparse
import json
import os
import sys
import urllib.request
from datetime import date

BASE_URL = "https://repoe-fork.github.io/"
FILES = ["mods.json", "base_items.json", "stat_translations.json", "version.txt"]
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
    for f in FILES:
        print("下載", BASE_URL + f)
        with urllib.request.urlopen(BASE_URL + f) as r, open(os.path.join(out, f), "wb") as w:
            w.write(r.read())
    return out


def load(src, name):
    with open(os.path.join(src, name), encoding="utf-8") as f:
        return json.load(f)


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

    # tag 字串集中成一張表，省空間
    tag_list, tag_idx = [], {}

    def T(t):
        if t not in tag_idx:
            tag_idx[t] = len(tag_list)
            tag_list.append(t)
        return tag_idx[t]

    # 隱含詞綴（底材固有）的文字
    def implicit_text(iid):
        m = mods.get(iid)
        return m["text"] if m and m.get("text") else None

    # 存檔裡的物品用底材「編號」記錄：順序不能變，新欄位只能往後加
    out_bases, icon_jobs = [], {}
    for bid, b in bases:
        dds = (b.get("visual_identity") or {}).get("dds_file") or ""
        ic = icon_name(dds) if dds else ""
        if ic:
            icon_jobs[ic] = dds
        out_bases.append({
            "n": b["name"],
            "c": b["item_class"],
            "lv": b["drop_level"],
            "t": [T(t) for t in b["tags"]],
            "imp": [x for x in (implicit_text(i) for i in b["implicits"]) if x],
            "w": b.get("inventory_width") or 1,   # 佔格大小
            "h": b.get("inventory_height") or 1,
            "ic": ic,                             # img/craft/items/ 底下的圖檔名
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

    # ── 詞綴文字（只留用得到的 stat id）──
    used_stats = {s["id"] for m in keep.values() for s in m["stats"]}
    out_trans, stat_to_tr, unknown = [], {}, set()
    for e in trans:
        if e.get("hidden") or not (set(e["ids"]) & used_stats):
            continue
        variants = []
        for v in e["English"]:
            for hs in v["index_handlers"]:
                for h in hs:
                    if h not in KNOWN_HANDLERS:
                        unknown.add(h)
            variants.append({
                "c": [[c.get("min"), c.get("max"), 1 if c.get("negated") else 0] for c in v["condition"]],
                "f": v["format"],
                "h": v["index_handlers"],
                "s": v["string"],
            })
        idx = len(out_trans)
        out_trans.append({"ids": e["ids"], "v": variants})
        for sid in e["ids"]:
            stat_to_tr.setdefault(sid, idx)

    out_mods = []
    for mid, m in sorted(keep.items()):
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
        })

    data = {
        "version": version,
        "built": date.today().isoformat(),
        "source": BASE_URL,
        "classes": {k: {"group": v[0], "zh": v[1]} for k, v in CLASSES.items()},
        "tags": tag_list,
        "bases": out_bases,
        "curIcons": cur_icons,
        "mods": out_mods,
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

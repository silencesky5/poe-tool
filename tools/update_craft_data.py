"""
每季更新製裝資料（雙擊專案根目錄的「更新製裝資料.bat」就會執行這支）。

步驟：
  1. 檢查版本：RePoE fork 的 version.txt 和 craft-data.js 的 version 一樣就結束
  2. 版本沒變時提示：新賽季剛開時 RePoE 可能還沒更新，晚點再試
  3. 下載英文＋繁中資料到 tools/_repoe_new/（上一版的快取 tools/_repoe_cache/ 先保留）
  4. 產生新資料並寫差異報告 docs/日期_製裝資料差異_舊版_to_新版.md；差異太大就停下來要人確認
  5. 存檔相容：存檔用底材 Metadata 路徑和詞綴 id，編號變了也不影響；被移除的底材／詞綴列在報告裡
  6. 換上新資料（舊的 craft-data.js 備份到 備份/），只下載新增的圖示
  7. 跑測試 tools/test_craft_engine.js；失敗就換回舊資料
  8. 本機預覽（http://localhost:8781/#craft）
  9. 確認後呼叫「上傳網站.bat」

用法：
    python tools/update_craft_data.py            # 一般使用
    python tools/update_craft_data.py --dry-run  # 只做到差異報告，不換資料
    python tools/update_craft_data.py --force    # 版本沒變也照跑（測試用）
    python tools/update_craft_data.py --src 資料夾  # 不下載，用已經下載好的 RePoE 檔案
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import webbrowser
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_craft_data as B  # noqa: E402

DATA_JS = os.path.join(ROOT, "craft-data.js")
CACHE = os.path.join(HERE, "_repoe_cache")
NEW = os.path.join(HERE, "_repoe_new")
PREV = os.path.join(HERE, "_repoe_prev")
BACKUP_DIR = os.path.join(ROOT, "備份")
DOCS = os.path.join(ROOT, "docs")
UPLOAD_BAT = os.path.join(ROOT, "上傳網站.bat")
BIG_CHANGE = 0.10   # 底材或詞綴有超過 10% 新增／移除／改變，就停下來要人確認
PREVIEW_PORT = 8781


def say(*a):
    print(*a, flush=True)


def ask(q):
    try:
        return input(q + " (Y/N) ").strip().lower() in ("y", "yes")
    except EOFError:
        return False


def read_data(path):
    s = open(path, encoding="utf-8").read()
    i = s.index("window.CRAFT_DATA=") + len("window.CRAFT_DATA=")
    return json.loads(s[i:].rstrip().rstrip(";"))


def remote_version():
    with urllib.request.urlopen(B.BASE_URL + "version.txt", timeout=30) as r:
        return r.read().decode("utf-8").strip()


def download(dest):
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    jobs = [(f, f) for f in B.FILES] + [(B.ZH_DIR + f, B.zh_name(f)) for f in B.ZH_FILES]
    for remote, local in jobs:
        url = B.BASE_URL + urllib.parse.quote(remote)
        say("  下載", url)
        with urllib.request.urlopen(url, timeout=300) as r, open(os.path.join(dest, local), "wb") as w:
            w.write(r.read())


def build(src, out, icons):
    cmd = [sys.executable, os.path.join(HERE, "build_craft_data.py"), "--src", src, "--out", out]
    if not icons:
        cmd.append("--no-icons")
    return subprocess.call(cmd)


# ── 差異 ──
def mod_sig(m, tags):
    """比較用：tag 編號換回名稱（每版的 tag 表順序可能不同）"""
    return {
        "g": m["g"], "gr": m["gr"], "ty": m["ty"], "lv": m["lv"], "st": m["st"], "tx": m["tx"],
        "sw": [[tags[t], w] for t, w in m["sw"]], "gw": [[tags[t], w] for t, w in m["gw"]],
        "at": [tags[t] for t in m["at"]],
    }


def diff(old, new):
    ob = {b.get("id") or b["n"]: b for b in old["bases"]}
    nb = {b.get("id") or b["n"]: b for b in new["bases"]}
    om = {m["id"]: m for m in old["mods"]}
    nm = {m["id"]: m for m in new["mods"]}
    changed = []
    for k in sorted(set(om) & set(nm)):
        a, b = mod_sig(om[k], old["tags"]), mod_sig(nm[k], new["tags"])
        what = [f for f in a if a[f] != b[f]]
        if what:
            changed.append((k, what))
    base_changed = [k for k in sorted(set(ob) & set(nb))
                    if {x: ob[k].get(x) for x in ("n", "c", "lv", "w", "h", "imp")} !=
                       {x: nb[k].get(x) for x in ("n", "c", "lv", "w", "h", "imp")}]
    return {
        "bases_added": sorted(set(nb) - set(ob)), "bases_removed": sorted(set(ob) - set(nb)),
        "bases_changed": base_changed,
        "mods_added": sorted(set(nm) - set(om)), "mods_removed": sorted(set(om) - set(nm)),
        "mods_changed": changed,
        "n_old": (len(ob), len(om)), "n_new": (len(nb), len(nm)),
        "zh_missing": {
            "底材名稱": sum(1 for b in new["bases"] if not b.get("nz") or b["nz"] == b["n"]),
            "詞綴名稱": sum(1 for m in new["mods"] if not m.get("nz") or m["nz"] == m["n"]),
            "詞綴文字模板": sum(1 for t in new["trans"] if "z" not in t),
        },
        "names": ({k: v["n"] for k, v in {**ob, **nb}.items()}, {k: v["n"] for k, v in {**om, **nm}.items()}),
    }


def ratios(d):
    b = (len(d["bases_added"]) + len(d["bases_removed"]) + len(d["bases_changed"])) / max(1, d["n_old"][0])
    m = (len(d["mods_added"]) + len(d["mods_removed"]) + len(d["mods_changed"])) / max(1, d["n_old"][1])
    return b, m


def write_report(d, old_v, new_v, path):
    bn, mn = d["names"]
    rb, rm = ratios(d)
    L = [f"# 製裝資料差異：{old_v} → {new_v}", "",
         f"- 產生日期：{date.today().isoformat()}",
         f"- 底材：{d['n_old'][0]} → {d['n_new'][0]}（新增 {len(d['bases_added'])}、移除 {len(d['bases_removed'])}、"
         f"改變 {len(d['bases_changed'])}，變動 {rb:.1%}）",
         f"- 詞綴：{d['n_old'][1]} → {d['n_new'][1]}（新增 {len(d['mods_added'])}、移除 {len(d['mods_removed'])}、"
         f"改變 {len(d['mods_changed'])}，變動 {rm:.1%}）",
         "- 缺中文：" + "、".join(f"{k} {v}" for k, v in d["zh_missing"].items()),
         f"- 變動超過 {BIG_CHANGE:.0%} 要人工確認：{'是' if max(rb, rm) > BIG_CHANGE else '否'}", "",
         "## 存檔相容", "",
         "存檔用底材的 Metadata 路徑和詞綴 id 記錄，編號改變不影響。",
         "下面「移除」的底材或詞綴，如果玩家存檔裡有，那件裝備會讀不回來（不會被刪掉，會原樣保留在存檔的 unreadable 裡）。", ""]

    def section(title, ids, names, extra=None):
        L.append(f"## {title}（{len(ids)}）")
        L.append("")
        for k in ids[:300]:
            L.append(f"- `{k}` {names.get(k, '')}" + (f"：{extra[k]}" if extra and k in extra else ""))
        if len(ids) > 300:
            L.append(f"- …另外 {len(ids) - 300} 筆")
        L.append("")

    section("新增的底材", d["bases_added"], bn)
    section("移除的底材", d["bases_removed"], bn)
    section("改變的底材（名稱、類別、等級、大小、固有詞綴）", d["bases_changed"], bn)
    section("新增的詞綴", d["mods_added"], mn)
    section("移除的詞綴", d["mods_removed"], mn)
    ch = dict(d["mods_changed"])
    section("改變的詞綴（括號是改變的欄位：sw 權重、gw 權重乘數、st 數值、lv 需求等級…）",
            [k for k, _ in d["mods_changed"]], mn, {k: "、".join(v) for k, v in ch.items()})
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")


def restore(backup, rotated):
    shutil.copyfile(backup, DATA_JS)
    if rotated and os.path.isdir(PREV):
        if os.path.isdir(CACHE):
            shutil.rmtree(CACHE)
        shutil.move(PREV, CACHE)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="不下載，改用這個資料夾裡的 RePoE 檔案")
    ap.add_argument("--force", action="store_true", help="版本沒變也照跑")
    ap.add_argument("--dry-run", action="store_true", help="只做到差異報告，不換資料")
    ap.add_argument("--report-dir", default=DOCS, help="差異報告放哪裡（預設 docs/）")
    a = ap.parse_args()

    old = read_data(DATA_JS)
    old_v = old["version"]

    # 1、2. 檢查版本
    say(f"[1/9] 檢查版本：目前 {old_v}")
    if a.src:
        p = os.path.join(a.src, "version.txt")
        new_v = open(p, encoding="utf-8").read().strip() if os.path.exists(p) else "unknown"
    else:
        try:
            new_v = remote_version()
        except Exception as e:
            say("  連不到 RePoE：", e)
            return 1
    say(f"      RePoE：{new_v}")
    if new_v == old_v and not a.force:
        say("[2/9] 版本一樣，不用更新。")
        say("      新賽季剛開時 RePoE 可能要幾天才會更新，晚點再試。")
        return 0

    # 3. 下載
    src = a.src
    if not src:
        say("[3/9] 下載資料到", NEW)
        download(NEW)
        src = NEW
    else:
        say("[3/9] 用指定的資料夾：", src)

    # 4. 產生新資料（先放在暫存檔）並寫差異報告
    say("[4/9] 產生新資料、比較差異")
    tmp_dir = NEW if not a.src else os.path.join(HERE, "_repoe_new_out")
    os.makedirs(tmp_dir, exist_ok=True)
    next_js = os.path.join(tmp_dir, "craft-data.next.js")
    if build(src, next_js, icons=False) != 0:
        say("  產生資料失敗，沒有換掉任何東西。")
        return 1
    new = read_data(next_js)
    d = diff(old, new)
    report = os.path.join(a.report_dir, f"{date.today().isoformat()}_製裝資料差異_{old_v}_to_{new['version']}.md")
    write_report(d, old_v, new["version"], report)
    rb, rm = ratios(d)
    say(f"      底材變動 {rb:.1%}、詞綴變動 {rm:.1%}，報告：{report}")
    if a.dry_run:
        say("  --dry-run：到這裡為止，沒有換掉任何東西。")
        return 0
    if max(rb, rm) > BIG_CHANGE:
        say(f"  差異超過 {BIG_CHANGE:.0%}，請先打開上面的報告看過。")
        if not ask("  確定要繼續更新嗎？"):
            say("  已取消，沒有換掉任何東西。")
            return 1

    # 5. 存檔相容
    say("[5/9] 存檔相容：存檔用穩定 id，不需要轉換。"
        + (f"被移除的底材 {len(d['bases_removed'])}、詞綴 {len(d['mods_removed'])}（見報告）" if d["bases_removed"] or d["mods_removed"] else ""))

    # 6. 換上新資料、下載新圖示
    say("[6/9] 換上新資料、下載新增的圖示")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup = os.path.join(BACKUP_DIR, f"craft-data_{old_v}_{date.today().isoformat()}.js")
    shutil.copyfile(DATA_JS, backup)
    say("      舊資料備份：", backup)
    rotated = not a.src
    if rotated:
        if os.path.isdir(PREV):
            shutil.rmtree(PREV)
        if os.path.isdir(CACHE):
            shutil.move(CACHE, PREV)
        os.remove(next_js)
        shutil.move(NEW, CACHE)
        src = CACHE
    if build(src, DATA_JS, icons=True) != 0:
        say("  產生資料或下載圖示失敗，換回舊資料。")
        restore(backup, rotated)
        return 1

    # 7. 測試
    say("[7/9] 跑測試")
    if subprocess.call(["node", os.path.join(HERE, "test_craft_engine.js")]) != 0:
        say("  測試沒有通過，換回舊資料。請把這個視窗截圖給 Claude。")
        restore(backup, rotated)
        return 1

    # 8. 本機預覽
    say("[8/9] 本機預覽")
    if ask("  要開本機預覽嗎？（會另外開一個視窗，看完把那個視窗關掉）"):
        subprocess.Popen([sys.executable, "-m", "http.server", str(PREVIEW_PORT)], cwd=ROOT,
                         creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0))
        webbrowser.open(f"http://localhost:{PREVIEW_PORT}/#craft")
        say("  請確認：製裝台、模擬器畫面正常，倉庫裡原本的裝備都還在。")

    # 9. 上傳
    say("[9/9] 上傳")
    if ask("  確認沒問題，要現在上傳網站嗎？"):
        return subprocess.call(["cmd", "/c", UPLOAD_BAT])
    say("  先不上傳。之後雙擊「上傳網站.bat」即可。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

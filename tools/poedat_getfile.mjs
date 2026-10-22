// 從官方更新伺服器的遊戲資料取出單一檔案（原樣存檔），給 extract_stash_layout.py 用。
// 用法：node tools/poedat_getfile.mjs <pathofexile-dat 所在資料夾> <快取資料夾> <patch> <遊戲內路徑> <輸出檔>
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [toolDir, cache, patch, file, out] = process.argv.slice(2);
const base = pathToFileURL(toolDir + '/node_modules/pathofexile-dat/dist/').href;
const L = await import(base + 'cli/bundle-loaders.js');
const U = await import(base + 'bundles/load-util.js');
const loader = await U.FileLoader.create(new L.CachingBundleLoader(await L.CdnBundleLoader.create(cache, patch)));
fs.writeFileSync(out, await loader.getFileContents(file));
console.log('取出', file, '→', out);

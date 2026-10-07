/* ============================================================
   英雄圍城 物價表 —— 改這裡，存檔，重新整理網頁就生效。

   遊戲：Hero Siege（Steam 269210），目前第十季 Ebontharn。
   沒有叫「Hero Siege 2」的獨立遊戲，2.0 是大改版，S7／S10 是季度編號。

   資料來源：符文名單出自官方 wiki（herosiege.wiki.gg），可信。
   其餘來自第三方攻略站，可信度普通，請以你遊戲裡看到的為準。

   ── 怎麼記價格 ───────────────────────────────
   找到那一行，把 price 的引號裡填上數字就好：

       { g:"通貨", name:"撒旦骰子", en:"Satanic Dice", price:"" },
                                                  ↓
       { g:"通貨", name:"撒旦骰子", en:"Satanic Dice", price:"120" },

   price 留空白 = 還沒記，網頁會顯示「未記錄」。
   數字隨便你寫，"1.5k" "2~3" "約 80" 都可以，網頁原樣顯示。
   只有純數字的才會參與「價格排序」。

   ── 欄位 ─────────────────────────────────────
   g      分類（側欄會自動長出來，順序照 HS_GROUPS）
   name   中文名
   en     英文名（選填，搜尋時兩邊都比對）
   price  價格
   tier   階級（選填，例如符文的 D／C／A／S）
   note   備註（選填）
   ============================================================ */


/* 計價單位。改這裡，整頁的單位跟著變。 */
const HS_UNIT = "金幣";

/* 分類的顯示順序。資料裡出現但沒列在這的，會排在最後面。 */
const HS_GROUPS = ["通貨與材料", "符文", "寶石", "珠寶", "遺物", "裝備"];


const HS_ITEMS = [

  /* ═══ 通貨與材料 ═══════════════════════════════ */
  { g:"通貨與材料", name:"金幣",     en:"Gold",         price:"", note:"基礎消費、NPC 買賣" },
  { g:"通貨與材料", name:"紅寶石",   en:"Rubies",       price:"", note:"玩家之間的主要交易媒介" },
  { g:"通貨與材料", name:"翡翠礦",   en:"Jade Ore",     price:"", note:"後期合成升級" },
  { g:"通貨與材料", name:"藍晶體",   en:"Blue Crystal", price:"", note:"" },
  { g:"通貨與材料", name:"紅晶體",   en:"Red Crystal",  price:"", note:"" },
  { g:"通貨與材料", name:"撒旦骰子", en:"Satanic Dice", price:"",
    note:"重骰 Satanic 以上物品數值。40% 機率腐化，腐化後數值大降且不能再用" },

  /* ═══ 符文 ═════════════════════════════════════
     名單來自官方 wiki。階級區間：D 11–17、C 19–41、A 43–55、S 57–69。
     wiki 沒有逐個列出需求等級，所以這裡只標階級。 */

  { g:"符文", name:"Old",  en:"Old",  tier:"D", price:"" },
  { g:"符文", name:"Ol",   en:"Ol",   tier:"D", price:"" },
  { g:"符文", name:"Tor",  en:"Tor",  tier:"D", price:"" },
  { g:"符文", name:"Naf",  en:"Naf",  tier:"D", price:"" },
  { g:"符文", name:"Uth",  en:"Uth",  tier:"D", price:"" },
  { g:"符文", name:"Eth",  en:"Eth",  tier:"D", price:"" },
  { g:"符文", name:"Tul",  en:"Tul",  tier:"D", price:"" },

  { g:"符文", name:"Rex",  en:"Rex",  tier:"C", price:"" },
  { g:"符文", name:"Ert",  en:"Ert",  tier:"C", price:"" },
  { g:"符文", name:"Thal", en:"Thal", tier:"C", price:"" },
  { g:"符文", name:"Ymn",  en:"Ymn",  tier:"C", price:"" },
  { g:"符文", name:"Nut",  en:"Nut",  tier:"C", price:"" },
  { g:"符文", name:"Del",  en:"Del",  tier:"C", price:"" },
  { g:"符文", name:"Hel",  en:"Hel",  tier:"C", price:"" },
  { g:"符文", name:"Io",   en:"Io",   tier:"C", price:"" },
  { g:"符文", name:"Lum",  en:"Lum",  tier:"C", price:"" },
  { g:"符文", name:"Co",   en:"Co",   tier:"C", price:"" },
  { g:"符文", name:"Fel",  en:"Fel",  tier:"C", price:"" },

  { g:"符文", name:"Lem",  en:"Lem",  tier:"A", price:"" },
  { g:"符文", name:"Pul",  en:"Pul",  tier:"A", price:"" },
  { g:"符文", name:"Um",   en:"Um",   tier:"A", price:"" },
  { g:"符文", name:"Mal",  en:"Mal",  tier:"A", price:"" },
  { g:"符文", name:"Ist",  en:"Ist",  tier:"A", price:"" },
  { g:"符文", name:"Gul",  en:"Gul",  tier:"A", price:"" },
  { g:"符文", name:"Vex",  en:"Vex",  tier:"A", price:"" },

  { g:"符文", name:"Qi",   en:"Qi",   tier:"S", price:"" },
  { g:"符文", name:"Xo",   en:"Xo",   tier:"S", price:"" },
  { g:"符文", name:"Sur",  en:"Sur",  tier:"S", price:"" },
  { g:"符文", name:"Ber",  en:"Ber",  tier:"S", price:"" },
  { g:"符文", name:"Jah",  en:"Jah",  tier:"S", price:"" },
  { g:"符文", name:"Drax", en:"Drax", tier:"S", price:"" },
  { g:"符文", name:"Zed",  en:"Zed",  tier:"S", price:"" },

  /* ═══ 寶石 ═════════════════════════════════════
     wiki 上只查到這一個，其餘請你自己往下加。 */
  { g:"寶石", name:"月光石", en:"Moonstone Gem", tier:"SS", price:"", note:"+7% 攻擊速度" },

  /* ═══ 珠寶 ═════════════════════════════════════ */
  { g:"珠寶", name:"Agathetheum 珠寶", en:"Agathetheum Jewel", tier:"B", price:"",
    note:"+75% 傷害反彈給攻擊者" },

  /* ═══ 遺物 ═════════════════════════════════════
     wiki 資料不全，先留空。照上面的格式往下加就好。 */

  /* ═══ 裝備 ═════════════════════════════════════ */

];

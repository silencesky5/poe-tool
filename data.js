/* ============================================================
   資料檔 —— 改這裡，存檔，重新整理網頁就生效。

   ── 資料夾 ───────────────────────────────────
   C:\poe-tool\
       index.html   data.js   terms.js   dust.js
       img\boss\    頭目橫幅   建議 640×280 jpg
       img\item\    提示框截圖  png，檔名 = 中文物品名
       img\icon\    小圖示     png，檔名 = 中文物品名
   ────────────────────────────────────────────

   ── 頭目 ─────────────────────────────────────
   {
     name:"中文王名", en:"English", group:"至高",
     img:"shaper.jpg",              沒有留 ""
     note:"進入條件",
     tiers:[ "一般", {name:"終極", title:"終極釋界"} ],   多階段才寫
     entry:[ ... ],  drops:[ ... ]
   }

   ── 入場碎片 ─────────────────────────────────
   { name:"釋界之令", count:1, only:"一般" },
   only 可以是字串或陣列： only:["終極","終極終極"]
   不寫 only = 每個階段都要

   ── 掉落 ─────────────────────────────────────
   {
     name:"鑄星",           ← 同時也是圖片檔名
     en:"Starforge", base:"地獄劍",
     type:"傳奇",           傳奇/珠寶/普通/通貨/碎片/技能/卡片/屍體/野獸/任務
     only:"一般",           不寫 = 每個階段都掉
     rate:"44%",            "?" = 查過但未公開；不寫 = 還沒查
     dust:31710,            不寫的話會自動查 dust.js
     note:"備註",
     variants:["火焰","冰冷"],   多變體，圖檔名為「物品名_變體名」
   }

   ── 排序規則（本檔已照此整理）──────────────
   每個王的 drops 依序分組：各階段限定 → 共同掉落
   組內先按 type 排（傳奇在前），同 type 再按機率高低
   ============================================================ */

const BOSSES = [

  {
    name: "釋界",
    en: "The Shaper",
    group: "",
    img: "",
    note: "引導地圖集滿四塊塑界者碎片後開啟。",

    tiers: [
      "一般",
      { name:"終極", title:"終極釋界" },
    ],

    entry: [
      { name:"釋界之令", count:1, only:"一般" },

      { name:"現實碎片", count:4, only:"終極" },
    ],

    drops: [
      { name:"傳承憤怒",       en:"", type:"傳奇", only:"一般", rate:"44%" },
      { name:"格雷文的秘密",   en:"", type:"傳奇", only:"一般", rate:"16%" },
      { name:"昂恩的煩惱",     en:"", type:"傳奇", only:"一般", rate:"16%" },
      { name:"奧莉西亞的喜悅", en:"", type:"傳奇", only:"一般", rate:"16%" },
      { name:"達佩爾甘格偽裝", en:"", type:"傳奇", only:"一般", rate:"7%" },
      { name:"核聲",           en:"", type:"傳奇", only:"一般", rate:"1%" },

      { name:"維里迪的薄紗",   en:"", type:"傳奇", only:"終極", rate:"52%" },
      { name:"逃脫不能",       en:"", type:"傳奇", only:"終極", rate:"33%" },
      { name:"女神恩典",       en:"", type:"傳奇", only:"終極", rate:"13%" },
      { name:"生育",           en:"", type:"傳奇", only:"終極", rate:"2%" },
      { name:"野心之逸品",     en:"", type:"通貨", only:"終極", rate:"5%" },
      { name:"閃耀遺鑰",       en:"", type:"通貨", only:"終極", rate:"1.5%" },
      { name:"覺醒．賦予輔助", en:"", type:"技能", only:"終極", rate:"0.25%" },
      { name:"覺醒．增幅輔助", en:"", type:"技能", only:"終極", rate:"0.25%" },
      { name:"覺醒．啟蒙輔助", en:"", type:"技能", only:"終極", rate:"0.25%" },

      { name:"衝突寶珠",       en:"", type:"通貨", rate:"35%" },
      { name:"朔望輔助",       en:"", type:"技能", rate:"5%" },
      { name:"規則逆反輔助",   en:"", type:"技能", rate:"5%" },
      { name:"吉祥之志",       en:"", type:"卡片", rate:"" },
      { name:"儀式虛空石",     en:"", type:"任務", rate:"100%" },
    ],
  },

  {
    name: "塞勒斯",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極", title:"終極塞勒斯" },
    ],

    entry: [
      { name:"維羅提尼亞刻紋", count:1, only:"一般" },
      { name:"圖拉克斯刻紋",   count:1, only:"一般" },
      { name:"奧赫茲名刻紋",   count:1, only:"一般" },
      { name:"巴倫刻紋",       count:1, only:"一般" },

      { name:"覺醒碎片",       count:4, only:"終極" },
    ],

    drops: [
      { name:"聖宗神手",       en:"", type:"傳奇", only:"一般", rate:"40%" },
      { name:"暗眼之冠",       en:"", type:"傳奇", only:"一般", rate:"35%" },
      { name:"真理負擔",       en:"", type:"傳奇", only:"一般", rate:"20%" },
      { name:"希望之絃",       en:"", type:"珠寶", only:"一般", rate:"5%" },

      { name:"希望之絃",       en:"", type:"傳奇", only:"終極", rate:"55%" },
      { name:"風暴崛起",       en:"", type:"傳奇", only:"終極", rate:"37%" },
      { name:"奧瑞亞之終",     en:"", type:"傳奇", only:"終極", rate:"7.5%" },
      { name:"救世主",         en:"", type:"傳奇", only:"終極", rate:"1%" },

      { name:"喚醒者之玉",     en:"", type:"通貨", rate:"15%" },
      { name:"支配之玉",       en:"", type:"通貨", rate:"10%" },
      { name:"湮滅輔助",       en:"", type:"技能", rate:"" },
      { name:"比死更慘的命運", en:"", type:"卡片", rate:"4%" },
    ],
  },

  {
    name: "吞噬天地",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極", title:"終極吞噬天地" },
    ],

    entry: [
      { name:"尖嘯之邀", count:1, only:"一般" },

      { name:"吞噬碎片", count:4, only:"終極" },
    ],

    drops: [
      { name:"無法掙脫之命", en:"", type:"傳奇", only:"一般", rate:"55%" },
      { name:"饕餮浪潮",     en:"", type:"傳奇", only:"一般", rate:"43%" },
      { name:"血肉融合",     en:"", type:"珠寶", only:"一般", rate:"2%" },

      { name:"貪婪的激情",   en:"", type:"傳奇", only:"終極", rate:"68%" },
      { name:"星塵",         en:"", type:"傳奇", only:"終極", rate:"30%" },
      { name:"尼米斯",       en:"", type:"傳奇", only:"終極", rate:"2%" },
      { name:"禁忌血肉",     en:"", type:"珠寶", only:"終極", rate:"" },
      { name:"消耗之逸品",   en:"", type:"通貨", only:"終極", rate:"5%" },
      { name:"吞噬遺鑰",     en:"", type:"通貨", only:"終極", rate:"1%" },

      { name:"禁忌血肉",     en:"", type:"珠寶", rate:"5%" },
      { name:"卓越異能靈液", en:"", type:"通貨", rate:"15%" },
      { name:"異能無效石",   en:"", type:"通貨", rate:"5%" },
      { name:"異能混沌石",   en:"", type:"通貨", rate:"5%" },
      { name:"異能崇高石",   en:"", type:"通貨", rate:"5%" },
      { name:"暴食輔助",     en:"", type:"技能", rate:"" },
      { name:"吉祥之志",     en:"", type:"卡片", rate:"" },
      { name:"異能虛空石",   en:"", type:"任務", rate:"100%" },
    ],
  },

  {
    name: "灼烙總督",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極", title:"終極灼烙總督" },
    ],

    entry: [
      { name:"熾熱之邀", count:1, only:"一般" },

      { name:"熾熱碎片", count:4, only:"終極" },
    ],

    drops: [
      { name:"破曉",         en:"", type:"傳奇", only:"一般", rate:"63%" },
      { name:"晨行者",       en:"", type:"傳奇", only:"一般", rate:"35%" },
      { name:"血肉溶解",     en:"", type:"珠寶", only:"一般", rate:"2%" },

      { name:"毀滅白光",     en:"", type:"傳奇", only:"終極", rate:"45.5%" },
      { name:"殲滅的方法",   en:"", type:"傳奇", only:"終極", rate:"29%" },
      { name:"晶化全知",     en:"", type:"傳奇", only:"終極", rate:"24%" },
      { name:"眾星援護",     en:"", type:"傳奇", only:"終極", rate:"1.5%" },
      { name:"禁忌烈焰",     en:"", type:"珠寶", only:"終極", rate:"" },
      { name:"融合之逸品",   en:"", type:"通貨", only:"終極", rate:"5%" },
      { name:"文書遺鑰",     en:"", type:"通貨", only:"終極", rate:"1.5%" },

      { name:"禁忌烈焰",     en:"", type:"珠寶", rate:"5%" },
      { name:"卓越異能灰燼", en:"", type:"通貨", rate:"15%" },
      { name:"異能無效石",   en:"", type:"通貨", rate:"5%" },
      { name:"異能混沌石",   en:"", type:"通貨", rate:"5%" },
      { name:"異能崇高石",   en:"", type:"通貨", rate:"5%" },
      { name:"過熱輔助",     en:"", type:"技能", rate:"" },
      { name:"吉祥之志",     en:"", type:"卡片", rate:"" },
      { name:"異能虛空石",   en:"", type:"任務", rate:"100%" },
    ],
  },

  {
    name: "塑界者",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極", title:"終極塑界者" },
    ],

    entry: [
      { name:"九頭蛇斷片", count:1, only:"一般" },
      { name:"奇美拉斷片", count:1, only:"一般" },
      { name:"鳳凰斷片",   count:1, only:"一般" },
      { name:"牛頭斷片",   count:1, only:"一般" },

      { name:"宇宙碎片",   count:4, only:"終極" },
    ],

    drops: [
      { name:"塑者之觸",       en:"", type:"傳奇", only:"一般", rate:"56%" },
      { name:"虛空行者",       en:"", type:"傳奇", only:"一般", rate:"26%" },
      { name:"守夜之至",       en:"", type:"傳奇", only:"一般", rate:"15%" },
      { name:"滅日",           en:"", type:"傳奇", only:"一般", rate:"3%" },

      { name:"創造迴聲",       en:"", type:"傳奇", only:"終極", rate:"40%" },
      { name:"熵毀滅",         en:"", type:"傳奇", only:"終極", rate:"36%" },
      { name:"時間之潮",       en:"", type:"傳奇", only:"終極", rate:"22%" },
      { name:"核星",           en:"", type:"傳奇", only:"終極", rate:"2%" },
      { name:"崇高願景",       en:"", type:"珠寶", only:"終極", rate:"2%" },
      { name:"宇宙遺鑰",       en:"", type:"通貨", only:"終極", rate:"1%" },

      { name:"塑界者的崇高石", en:"", type:"通貨", rate:"12%" },
      { name:"支配之玉",       en:"", type:"通貨", rate:"3%" },
      { name:"智慧斷片",       en:"", type:"碎片", rate:"100%" },
      { name:"雕塑斷片",       en:"", type:"碎片", rate:"100%" },
      { name:"虛空風暴輔助",   en:"", type:"技能", rate:"" },
    ],
  },

  {
    name: "維那利斯",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"贗品", title:"維那利斯" },
      { name:"終極", title:"終極維那利斯" },
    ],

    entry: [
      { name:"深沉記憶",      count:1, only:"一般" },

      { name:"贗品-深沉記憶", count:1, only:"贗品" },

      { name:"追憶碎片",      count:4, only:"終極" },
    ],

    drops: [
      { name:"蛇皮獻祭",         en:"", type:"傳奇", only:"一般", rate:"45%" },
      { name:"極轉電刑",         en:"", type:"傳奇", only:"一般", rate:"35%" },
      { name:"無常禮袍",         en:"", type:"傳奇", only:"一般", rate:"15%" },
      { name:"瓶中信仰",         en:"", type:"傳奇", only:"一般", rate:"5%" },

      { name:"銀河星雲",         en:"", type:"傳奇", only:"終極", rate:"40%" },
      { name:"審判莊嚴",         en:"", type:"傳奇", only:"終極", rate:"30%" },
      { name:"叛教者",           en:"", type:"傳奇", only:"終極", rate:"15%" },
      { name:"野心之環",         en:"", type:"傳奇", only:"終極", rate:"10%" },
      { name:"理性主義",         en:"", type:"珠寶", only:"終極", rate:"5%" },
      { name:"遺忘遺鑰",         en:"", type:"通貨", only:"終極", rate:"1.5%" },

      { name:"高階力量紊亂輔助", en:"", type:"技能", rate:"" },
      { name:"勾鎖",             en:"", type:"卡片", rate:"3%" },
    ],
  },

  {
    name: "異界尊師",
    en: "The Elder",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極",     title:"終極異界尊師" },
      { name:"終極終極", title:"終極終極異界尊師" },
    ],

    entry: [
      { name:"淨化斷片", count:1, only:"一般" },
      { name:"干擾斷片", count:1, only:"一般" },
      { name:"奴役斷片", count:1, only:"一般" },
      { name:"根除斷片", count:1, only:"一般" },

      { name:"智慧斷片", count:1, only:"終極" },
      { name:"雕塑斷片", count:1, only:"終極" },
      { name:"恐懼斷片", count:1, only:"終極" },
      { name:"空虛斷片", count:1, only:"終極" },

      { name:"腐朽碎片", count:4, only:"終極終極" },
    ],

    drops: [
      { name:"看守之眼(2詞綴)",  en:"Watcher's Eye",              type:"傳奇", only:"一般",              rate:"40%" },
      { name:"巨岩之環",         en:"Cyclopean Coil",             type:"傳奇", only:"一般",              rate:"30%" },
      { name:"褻瀆者之握",       en:"Blasphemer's Grasp",         type:"傳奇", only:"一般",              rate:"30%" },
      { name:"銀河眾星",         en:"Nebuloch",                   type:"傳奇", only:"一般",              rate:"10%" },
      { name:"破滅之希",         en:"Hopeshredder",               type:"傳奇", only:"一般",              rate:"10%" },
      { name:"低伏微光",         en:"Shimmeron",                  type:"傳奇", only:"一般",              rate:"10%" },
      { name:"虛空元素",         en:"Void of the Elements",       type:"傳奇", only:"一般",              rate:"1%" },
      { name:"尊師的崇高石",     en:"Elder's Exalted Orb",        type:"通貨", only:"一般",              rate:"10%" },
      { name:"支配之玉",         en:"Orb of Dominance",           type:"通貨", only:"一般",              rate:"2%" },
      { name:"恐懼斷片",         en:"Fragment of Terror",         type:"碎片", only:"一般",              rate:"100%" },
      { name:"空虛斷片",         en:"Fragment of Emptiness",      type:"碎片", only:"一般",              rate:"100%" },
      { name:"異界詛咒光環輔助", en:"Eldritch Blasphemy Support", type:"技能", only:"一般" },

      { name:"塑者之印",         en:"Mark of the Shaper",         type:"傳奇", only:"終極",              rate:"35%" },
      { name:"尊師之印",         en:"Mark of the Elder",          type:"傳奇", only:"終極",              rate:"35%" },
      { name:"虛眼箭矢",         en:"Voidfletcher",               type:"傳奇", only:"終極",              rate:"15%" },
      { name:"地印之環",         en:"Indigon",                    type:"傳奇", only:"終極",              rate:"12%" },
      { name:"滅碎獠杖",         en:"Disintegrator",              type:"傳奇", only:"終極",              rate:"3%" },

      { name:"虛空元素",         en:"Void of the Elements",       type:"傳奇", only:["終極","終極終極"], rate:"1%" },
      { name:"看守之眼(3詞綴)",  en:"Watcher's Eye",              type:"珠寶", only:["終極","終極終極"], rate:"30%" },
      { name:"塑界者的崇高石",   en:"Shaper's Exalted Orb",       type:"通貨", only:["終極","終極終極"], rate:"15%" },
      { name:"尊師的崇高石",     en:"Elder's Exalted Orb",        type:"通貨", only:["終極","終極終極"], rate:"10%" },
      { name:"支配之玉",         en:"Orb of Dominance",           type:"通貨", only:["終極","終極終極"], rate:"5%" },
      { name:"虛空震波輔助",     en:"Void Shockwave Support",     type:"技能", only:["終極","終極終極"] },
      { name:"冷卻恢復輔助",     en:"Cooldown Recovery Support",  type:"技能", only:["終極","終極終極"] },
      { name:"吉祥之志",         en:"Auspicious Ambitions",       type:"卡片", only:["終極","終極終極"], rate:"1%" },
      { name:"腐朽虛空石",       en:"Decayed Voidstone",          type:"任務", only:["終極","終極終極"], rate:"首殺必掉" },

      { name:"虛空呼喚",         en:"Call of the Void",           type:"傳奇", only:"終極終極",          rate:"40%" },
      { name:"心靈吞噬者",       en:"The Devourer of Minds",      type:"傳奇", only:"終極終極",          rate:"30%" },
      { name:"靈魂昇華",         en:"Soul Ascension",             type:"傳奇", only:"終極終極",          rate:"10%" },
      { name:"不在場證明",       en:"Impresence",                 type:"傳奇", only:"終極終極",          rate:"10%",      note:"六種元素版本，每次必掉其中一種", variants:["火焰","冰冷","閃電","物理","混沌","雙詛咒"] },
      { name:"永恆屍布",         en:"The Eternity Shroud",        type:"傳奇", only:"終極終極",          rate:"6%" },
      { name:"腐化之逸品",       en:"Curio of Decay",             type:"傳奇", only:"終極終極",          rate:"5%" },
      { name:"核虛",             en:"Voidforge",                  type:"傳奇", only:"終極終極",          rate:"4%" },
      { name:"崇高願景",         en:"Sublime Vision",             type:"傳奇", only:"終極終極",          rate:"1%" },
      { name:"腐化遺鑰",         en:"Decaying Reliquary Key",     type:"碎片", only:"終極終極",          rate:"1.5%" },
    ],
  },

  {
    name: "恐慌化身",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極", title:"終極恐慌化身" },
    ],

    entry: [
      { name:"敬畏之迴響", count:1, only:"一般" },

      { name:"敬畏碎片",   count:4, only:"終極" },
    ],

    drops: [
      { name:"骨融",       en:"",           type:"傳奇", only:"一般", rate:"55%" },
      { name:"黑暗君主",   en:"",           type:"傳奇", only:"一般", rate:"35%" },
      { name:"七大教誨",   en:"",           type:"傳奇", only:"一般", rate:"8%" },
      { name:"預言家之酒", en:"",           type:"傳奇", only:"一般", rate:"2%" },

      { name:"受祈聖君",   en:"",           type:"傳奇", only:"終極", rate:"~54%" },
      { name:"無盡低語",   en:"",           type:"傳奇", only:"終極", rate:"30%" },
      { name:"井泉魂罐",   en:"",           type:"傳奇", only:"終極", rate:"14%" },
      { name:"黃金詐術師", en:"",           type:"傳奇", only:"終極", rate:"2%" },
      { name:"敬畏遺鑰",   en:"",           type:"通貨", only:"終極", rate:"1%" },

      { name:"被命運束縛", en:"",           type:"珠寶", rate:"10%" },
      { name:"星盤",       en:"Guaranteed", type:"通貨", rate:"33%",  note:"10種星盤", variants:["聖堂","碩果","無光","執掌","無名","菌群","混沌","幻象","永恆","符文"] },
      { name:"拆解石",     en:"",           type:"通貨", rate:"" },
      { name:"聚眾輔助",   en:"",           type:"技能", rate:"" },
    ],
  },

  {
    name: "恐懼化身",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極", title:"終極恐懼化身" },
    ],

    entry: [
      { name:"創傷之迴響", count:1, only:"一般" },

      { name:"創傷碎片",   count:4, only:"終極" },
    ],

    drops: [
      { name:"喚星者",       en:"",           type:"傳奇", only:"一般", rate:"~2%" },
      { name:"無形之彩",     en:"",           type:"傳奇", only:"一般", rate:"",    note:"3種戒指",  variants:["焦灼","易碎","殘喘"] },
      { name:"腐蝕使徒",     en:"",           type:"傳奇", only:"一般", rate:"" },
      { name:"惡言之擁",     en:"",           type:"傳奇", only:"一般", rate:"" },

      { name:"悲嘆之刺",     en:"",           type:"傳奇", only:"終極", rate:"2%" },
      { name:"盤繞細語",     en:"",           type:"傳奇", only:"終極", rate:"" },
      { name:"囚籠猛獸",     en:"",           type:"傳奇", only:"終極", rate:"" },
      { name:"飛龍之翼",     en:"",           type:"傳奇", only:"終極", rate:"" },
      { name:"創傷遺鑰",     en:"",           type:"通貨", only:"終極", rate:"1%" },

      { name:"被命運束縛",   en:"",           type:"珠寶", rate:"10%" },
      { name:"星盤",         en:"Guaranteed", type:"通貨", rate:"33%", note:"10種星盤", variants:["聖堂","碩果","無光","執掌","無名","菌群","混沌","幻象","永恆","符文"] },
      { name:"意志石",       en:"",           type:"通貨", rate:"?%" },
      { name:"高階吞噬輔助", en:"",           type:"技能", rate:"?%" },
    ],
  },

  {
    name: "漠視化身",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極", title:"終極恐懼漠視" },
    ],

    entry: [
      { name:"孤獨之迴響", count:1, only:"一般" },

      { name:"孤獨碎片",   count:4, only:"終極" },
    ],

    drops: [
      { name:"反叛之針",       en:"",           type:"傳奇", only:"一般", rate:"50%" },
      { name:"執政官的工具",   en:"",           type:"傳奇", only:"一般", rate:"38%" },
      { name:"維那利斯的星盤", en:"",           type:"傳奇", only:"一般", rate:"10%" },
      { name:"玫瑰的傳承",     en:"",           type:"傳奇", only:"一般", rate:"2%" },

      { name:"孤寂庇所",       en:"",           type:"傳奇", only:"終極", rate:"55%" },
      { name:"苦澀直覺",       en:"",           type:"傳奇", only:"終極", rate:"30%" },
      { name:"縈繞回憶",       en:"",           type:"傳奇", only:"終極", rate:"13%" },
      { name:"潰爛怨恨",       en:"",           type:"傳奇", only:"終極", rate:"2%" },
      { name:"孤獨遺鑰",       en:"",           type:"通貨", only:"終極", rate:"1%" },

      { name:"被命運束縛",     en:"",           type:"珠寶", rate:"10%" },
      { name:"回想石",         en:"",           type:"通貨", rate:"33%" },
      { name:"星盤",           en:"Guaranteed", type:"通貨", rate:"33%", note:"10種星盤", variants:["聖堂","碩果","無光","執掌","無名","菌群","混沌","幻象","永恆","符文"] },
      { name:"非黑即白",       en:"",           type:"通貨", rate:"3%" },
      { name:"霜法輔助",       en:"",           type:"技能", rate:"5%" },
    ],
  },

  {
    name: "黯星",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
    ],

    entry: [
      { name:"極地之邀", count:1, only:"一般" },
    ],

    drops: [
      { name:"極地毀滅", en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"黎明驟起", en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"永恆鬥爭", en:"", type:"傳奇", only:"一般", rate:"" },
    ],
  },

  {
    name: "灼燒食糜",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
    ],

    entry: [
      { name:"纏繞之邀", count:1, only:"一般" },
    ],

    drops: [
      { name:"無盡盛宴", en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"漆黑極頂", en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"永恆鬥爭", en:"", type:"傳奇", only:"一般", rate:"" },
    ],
  },

    {
    name: "薩雷許(v3.28)",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
    ],

    entry: [
      { name:"漆黑巨靈之幣", count:1, only:"一般" },
    ],

    drops: [
      { name:"塵燥之吼", en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"破碎輓歌", en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"時間之砂", en:"", type:"傳奇", only:"一般", rate:"" },
    ],
  },

  {
    name: "迷霧之王(v3.13)",
    group: "",
    img: "",
    note: "擊殺必定掉落下列傳奇其中一件（機率為 3.26 群眾統計，n=576；咒閃輔助為 3.28 新增）。另有 50% 機率掉落高價值屍體，只限貢品 1000 以上的屍體，完美／一般／劣化 = 20%／30%／50%，並依怪物種類加權，所以單一種完美屍體的實際機率會低於 10%。擊殺後會生成無光祭壇，可把血脈升華換成無名血脈。",

    tiers: [
      "一般",
    ],

    entry: [
      { name:"謁見國王", count:1, only:"一般" },
    ],

    drops: [
      { name:"聖潔之魂",     en:"The Untouched Soul",    type:"傳奇", only:"一般", rate:"40%" },
      { name:"實用主義",     en:"Pragmatism",            type:"傳奇", only:"一般", rate:"35%" },
      { name:"意涵之光",     en:"The Light of Meaning",  type:"珠寶", only:"一般", rate:"20%" },
      { name:"沉重陰影",     en:"The Burden of Shadows", type:"傳奇", only:"一般", rate:"5%" },
      { name:"咒閃輔助",     en:"Hexpass Support",       type:"技能", only:"一般", rate:"10%" },
      { name:"咒蟾輔助",     en:"Hextoad Support",       type:"技能", only:"一般", rate:"6%" },
      { name:"無盡黯黑",     en:"The Endless Darkness",  type:"卡片", only:"一般", rate:"" },
      { name:"完美森林猛虎", en:"",                      type:"屍體", only:"一般", pool:"完美屍體 10%" },
      { name:"完美腦殘巨人", en:"",                      type:"屍體", only:"一般", pool:"完美屍體 10%" },
      { name:"完美督軍",     en:"",                      type:"屍體", only:"一般", pool:"完美屍體 10%" },
      { name:"完美守護野龜", en:"",                      type:"屍體", only:"一般", pool:"完美屍體 10%" },
      { name:"完美海軍軍官", en:"",                      type:"屍體", only:"一般", pool:"完美屍體 10%" },
      { name:"完美財富之魂", en:"",                      type:"屍體", only:"一般", pool:"完美屍體 10%" },
    ],
  },

      {
    name: "豐收忌劫(v3.11)",
    group: "",
    img: "",
    note: "",

    tiers: [
      { name:"密園之相．奧莎比" },
      { name:"荊棘之母．埃爾希" },
	  { name:"夜誕．南莫哈姆" },
	  { name:"預兆．珍納爾" },
    ],

    entry: [],

    drops: [
	{ name:"悖逆審訊", en:"", type:"傳奇", only:"密園之相．奧莎比", rate:"50%" },
	{ name:"禁忌軍帽", en:"", type:"傳奇", only:"密園之相．奧莎比", rate:"19%" },
	{ name:"野性法則", en:"", type:"傳奇", only:"密園之相．奧莎比", rate:"19%" },
	{ name:"獵巫者的審判", en:"", type:"傳奇", only:"密園之相．奧莎比", rate:"12%" },
	
	{ name:"熊之束", en:"", type:"傳奇", only:"荊棘之母．埃爾希", rate:"" },
	{ name:"晶化仇怨",         en:"", type:"通貨", only:"荊棘之母．埃爾希", rate:"" },
  { name:"神聖之花",         en:"", type:"通貨", only:"荊棘之母．埃爾希", rate:"" },
	{ name:"野性結晶生靈之力",         en:"", type:"通貨", only:"荊棘之母．埃爾希", rate:"" },

  { name:"追逐之羽", en:"", type:"傳奇", only:"預兆．珍納爾", rate:"" },
	{ name:"晶化仇怨",         en:"", type:"通貨", only:"預兆．珍納爾", rate:"" },
  { name:"神聖之花",         en:"", type:"通貨", only:"預兆．珍納爾", rate:"" },
	{ name:"原始結晶生靈之力",         en:"", type:"通貨", only:"預兆．珍納爾", rate:"" },
	
	{ name:"費爾博格獠牙", en:"", type:"傳奇", only:"夜誕．南莫哈姆", rate:"" },
	{ name:"晶化仇怨",         en:"", type:"通貨", only:"夜誕．南莫哈姆", rate:"" },
  { name:"神聖之花",         en:"", type:"通貨", only:"夜誕．南莫哈姆", rate:"" },
	{ name:"靈現結晶生靈之力",         en:"", type:"通貨", only:"夜誕．南莫哈姆", rate:"" },
	
    { name:"神聖結晶生靈之力",         en:"", type:"通貨", only:"密園之相．奧莎比", rate:"" },
    { name:"高階釋放輔助",       en:"", type:"技能", only:"密園之相．奧莎比", rate:"" },
    { name:"雄心",     en:"", type:"卡片", only:"密園之相．奧莎比", rate:"" },

    ],
  },

      {
    name: "譫妄異域(v3.10)",
    group: "",
    img: "",
    note: "",

    tiers: [
      { name:"天譴啟示．科賽斯" },
      { name:"恐懼造物．歐姆弗畢亞" },
    ],

    entry: [],

    drops: [
    { name:"浸血鬥旗輔助", en:"", type:"技能", only:"天譴啟示．科賽斯", rate:"" },
      { name:"悲慘幻視",     en:"", type:"珠寶", rate:"" },
    { name:"奇塔弗的教學", en:"", type:"珠寶", rate:"" },
    { name:"天性",         en:"", type:"珠寶", rate:"" },
    { name:"一無所有",     en:"", type:"珠寶", rate:"" },
    { name:"前列的線",     en:"", type:"珠寶", rate:"" },
    { name:"審問",         en:"", type:"珠寶", rate:"" },
      { name:"圍城",         en:"", type:"珠寶", rate:"" },
    { name:"瘋貓",         en:"", type:"珠寶", rate:"" },

    { name:"幻象異界",     en:"", type:"通貨", rate:"" },
    { name:"嗓音",         en:"", type:"珠寶", rate:"" },
    { name:"妄想症",       en:"", type:"珠寶", rate:"" },
    { name:"人格分裂",     en:"", type:"珠寶", rate:"" },
    { name:"瘋貓",         en:"", type:"卡片", rate:"" },

    ],
  },

    {
    name: "凋落禁地(v3.8)",
    group: "",
    img: "",
    note: "沒有專屬頭目。用凋落禁地地圖進入，打完凋落機制後開凋落保險箱取得；一般地圖遇到的凋落也會掉，但數量少很多。",
    link: "https://poedb.tw/tw/Blight_league",

    entry: [
      { name:"凋落禁地地圖", count:1 },
    ],

    drops: [
      { name:"偷息",     en:"",               type:"傳奇" },
      { name:"嗜炎斗篷", en:"",               type:"傳奇" },
      { name:"酷寒斗篷", en:"",               type:"傳奇" },
      { name:"狂雷斗篷", en:"",               type:"傳奇" },
      { name:"潰逃之靴", en:"",               type:"傳奇" },
      { name:"毒孢守衛", en:"",               type:"傳奇" },
      { name:"扼殺之息", en:"",               type:"傳奇" },

      { name:"菌群星盤", en:"",               type:"通貨" },

      { name:"清透油瓶", en:"Clear Oil",      type:"通貨", pool:"油瓶" },
      { name:"深褐油瓶", en:"Sepia Oil",      type:"通貨", pool:"油瓶" },
      { name:"琥珀油瓶", en:"Amber Oil",      type:"通貨", pool:"油瓶" },
      { name:"翠綠油瓶", en:"Verdant Oil",    type:"通貨", pool:"油瓶" },
      { name:"清綠油瓶", en:"Teal Oil",       type:"通貨", pool:"油瓶" },
      { name:"碧藍油瓶", en:"Azure Oil",      type:"通貨", pool:"油瓶" },
      { name:"靛青油瓶", en:"Indigo Oil",     type:"通貨", pool:"油瓶" },
      { name:"奼紫油瓶", en:"Violet Oil",     type:"通貨", pool:"油瓶" },
      { name:"緋紅油瓶", en:"Crimson Oil",    type:"通貨", pool:"油瓶" },
      { name:"漆黑油瓶", en:"Black Oil",      type:"通貨", pool:"油瓶" },
      { name:"乳白油瓶", en:"Opalescent Oil", type:"通貨", pool:"油瓶" },
      { name:"純銀油瓶", en:"Silver Oil",     type:"通貨", pool:"油瓶" },
      { name:"金黃油瓶", en:"Golden Oil",     type:"通貨", pool:"油瓶" },
      { name:"汙染油瓶", en:"Tainted Oil",    type:"通貨", pool:"油瓶" },
      { name:"映像油瓶", en:"Reflective Oil", type:"通貨", pool:"油瓶" },
      { name:"三相之油", en:"Prismatic Oil",  type:"通貨", pool:"油瓶" },
    ],
  },

  {
    name: "戰亂之殤(v3.7)",
    group: "",
    img: "",
    note: "",

    tiers: [
      { name:"不朽帝國", title:"穆希爾斯．獅眼將軍" },
      { name:"卡魯",     title:"西里娜馬庫女王" },
      { name:"瓦爾",     title:"邪魔毒蛇納普阿茲" },
      { name:"聖宗",     title:"大主教桑特斯瓦克斯" },
      { name:"馬拉克斯", title:"漆黑絲克瑪奧庫納" },
    ],

    entry: [

    ],

    drops: [
      { name:"優雅的高傲",       en:"", type:"珠寶", only:"不朽帝國", rate:"" },
      { name:"永恆不朽帝國裂片", en:"", type:"通貨", only:"不朽帝國", rate:"" },
      { name:"永恆壟罩晶石",     en:"", type:"通貨", only:"不朽帝國", rate:"" },

      { name:"致命的驕傲",       en:"", type:"珠寶", only:"卡魯",     rate:"" },
      { name:"永恆卡魯裂片",     en:"", type:"通貨", only:"卡魯",     rate:"" },
      { name:"卡魯壟罩晶石",     en:"", type:"通貨", only:"卡魯",     rate:"" },

      { name:"輝煌的虛榮",       en:"", type:"珠寶", only:"瓦爾",     rate:"" },
      { name:"永恆瓦爾裂片",     en:"", type:"通貨", only:"瓦爾",     rate:"" },
      { name:"瓦爾壟罩晶石",     en:"", type:"通貨", only:"瓦爾",     rate:"" },

      { name:"激進的信仰",       en:"", type:"珠寶", only:"聖宗",     rate:"" },
      { name:"永恆聖宗裂片",     en:"", type:"通貨", only:"聖宗",     rate:"" },
      { name:"聖宗壟罩晶石",     en:"", type:"通貨", only:"聖宗",     rate:"" },

      { name:"殘酷的紀律",       en:"", type:"珠寶", only:"馬拉克斯", rate:"" },
      { name:"永恆馬拉克斯裂片", en:"", type:"通貨", only:"馬拉克斯", rate:"" },
      { name:"馬拉克斯壟罩晶石", en:"", type:"通貨", only:"馬拉克斯", rate:"" },
    ],
  },

  {
    name: "卡塔莉娜(v3.5)",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
    ],

    entry: [
      { name:"密教獎章", count:1, only:"一般" },
    ],

    drops: [
      { name:"苦綑畸點",             en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"骷髏馬克的靈杖",       en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"噬燼甕",               en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"脊雹",                 en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"吞噬之冠",             en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"女王的渴望",           en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"隱匿崇高石",           en:"", type:"通貨", only:"一般", rate:"" },
      { name:"不滅之火骷髏馬克餘燼", en:"", type:"通貨", only:"一般", rate:"" },
      { name:"澤洛斯的無盡之眼",     en:"", type:"通貨", only:"一般", rate:"" },
      { name:"共融輔助",             en:"", type:"技能", only:"一般", rate:"" },
      { name:"邊緣之冠",             en:"", type:"卡片", only:"一般", rate:"" },
      { name:"守護者的腐敗",         en:"", type:"卡片", only:"一般", rate:"" },
    ],
  },

    {
    name: "掘獄聯盟(v3.4)",
    group: "",
    img: "",
    note: "",

    tiers: [
      { name:"先祖遺址", title:"晶之帝奧爾" },
      { name:"深淵古城", title:"非酋血統柯戈" },
      { name:"瓦爾哨站", title:"盲人阿烏塔利" },
    ],

    entry: [
    ],

    drops: [
    { name:"奧爾的崛起",         en:"", type:"傳奇", only:"先祖遺址", rate:"61%",     note:"4種", variants:["01","02","03","04"] },
      { name:"堂皇冠冕",           en:"", type:"傳奇", only:"先祖遺址", rate:"15%" },
      { name:"阿卡莉的草原",       en:"", type:"傳奇", only:"先祖遺址", rate:"8%" },
      { name:"尤莎莎的峽谷",       en:"", type:"傳奇", only:"先祖遺址", rate:"8%" },
      { name:"普坦堡的山巒",       en:"", type:"傳奇", only:"先祖遺址", rate:"8%" },
      { name:"輝煌寶藏",           en:"", type:"卡片", only:"先祖遺址", rate:"1%" },
      { name:"褻瀆的美德",         en:"", type:"卡片", only:"先祖遺址", rate:"" },

      { name:"強彈辯駁",           en:"", type:"傳奇", only:"深淵古城", rate:"40%+10%", note:"2種", variants:["01","02"] },
      { name:"闇核號令",           en:"", type:"傳奇", only:"深淵古城", rate:"15%+5%",  note:"2種", variants:["01","02"] },
      { name:"阿卡莉的峽谷",       en:"", type:"傳奇", only:"深淵古城", rate:"10%" },
      { name:"尤莎莎的山巒",       en:"", type:"傳奇", only:"深淵古城", rate:"10%" },
      { name:"普坦堡的草原",       en:"", type:"傳奇", only:"深淵古城", rate:"10%" },
      { name:"黑暗中的苦難",       en:"", type:"卡片", only:"深淵古城", rate:"20%" },
      { name:"澤洛斯的必然之眼",   en:"", type:"通貨", only:"深淵古城", rate:"50%" },

      { name:"獄犬殘肢",           en:"", type:"傳奇", only:"瓦爾哨站", rate:"60%" },
      { name:"多里亞尼的機械迷城", en:"", type:"地圖", only:"瓦爾哨站", rate:"16%" },
      { name:"阿卡莉的山巒",       en:"", type:"傳奇", only:"瓦爾哨站", rate:"8%" },
      { name:"尤莎莎的草原",       en:"", type:"傳奇", only:"瓦爾哨站", rate:"8%" },
      { name:"普坦堡的峽谷",       en:"", type:"傳奇", only:"瓦爾哨站", rate:"8%" },
      { name:"好奇",               en:"", type:"通貨", only:"瓦爾哨站", rate:"40%" },

    ],
  },

    {
    name: "時空穿越(v3.3)",
    group: "",
    img: "",
    note: "下列必定掉落其中一件；冒險犯難、野心是額外掉落。",

    tiers: [
      { name:"1", title:"瓦爾．全能" },
    ],

    entry: [],

    drops: [
      { name:"奴役之索", en:"", type:"傳奇", only:"1", rate:"45%+1%", note:"2種", variants:["01","02"] },
      { name:"追魂者",   en:"", type:"藥劑", only:"1", rate:"20%" },
      { name:"冶鍊之體", en:"", type:"傳奇", only:"1", rate:"7%" },
      { name:"冶鍊之意", en:"", type:"珠寶", only:"1", rate:"7%" },
      { name:"冶鍊之靈", en:"", type:"珠寶", only:"1", rate:"7%" },
      { name:"犧牲之心", en:"", type:"傳奇", only:"1", rate:"4%" },

      { name:"超越之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"28%" },
      { name:"召喚之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"17%" },
      { name:"儀式之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"17%" },
      { name:"命運之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"17%" },
      { name:"統御之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"10%" },
      { name:"因果之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"8%" },
      { name:"覺醒之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"2%" },
      { name:"獻祭之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"0.2%" },
      { name:"亡靈之罈", en:"", type:"珠寶", only:"1", pool:"罈 9%", rate:"0.2%" },

      { name:"野心",     en:"", type:"珠寶", only:"1", rate:"~7%" },
      { name:"冒險犯難", en:"", type:"卡片", only:"1", rate:"~2.5%" },
    ],
  },

  {
    name: "野獸首領(v3.2)",
    group: "",
    img: "",
    note: "",

    tiers: [
      { name:"獸性", title:"初始之地費爾羅" },
      { name:"飛沙", title:"初始之天斯卡沃" },
      { name:"洞窟", title:"初始之夜菲恩絲" },
      { name:"深潭", title:"初始之潭奎爾珊" },
    ],

    entry: [
      { name:"費爾羅猛虎幻獸", count:1, only:"獸性" },
      { name:"稀有野獸",       count:3, only:"獸性" },

      { name:"斯卡沃雛鳥",     count:1, only:"飛沙" },
      { name:"稀有野獸",       count:3, only:"飛沙" },

      { name:"菲恩絲混血蜘蛛", count:1, only:"洞窟" },
      { name:"稀有野獸",       count:3, only:"洞窟" },

      { name:"奎爾珊蛛蛛蟹",   count:1, only:"深潭" },
      { name:"稀有野獸",       count:3, only:"深潭" },
    ],

    drops: [
      { name:"費爾羅咥喙",     en:"", type:"傳奇", only:"獸性", rate:"" },
      { name:"費爾羅羽衣",     en:"", type:"傳奇", only:"獸性", rate:"" },
      { name:"費爾羅鋒爪",     en:"", type:"傳奇", only:"獸性", rate:"" },
      { name:"費爾羅獵靴",     en:"", type:"傳奇", only:"獸性", rate:"" },
      { name:"費爾羅魔符",     en:"", type:"普通", only:"獸性", rate:"" },
      { name:"初始之地費爾羅", en:"", type:"野獸", only:"獸性", rate:"" },

      { name:"斯卡沃之徒",     en:"", type:"傳奇", only:"飛沙", rate:"" },
      { name:"斯卡沃之巢",     en:"", type:"傳奇", only:"飛沙", rate:"" },
      { name:"斯卡沃之翼",     en:"", type:"傳奇", only:"飛沙", rate:"" },
      { name:"斯卡沃鷹爪",     en:"", type:"傳奇", only:"飛沙", rate:"" },
      { name:"斯卡沃魔符",     en:"", type:"普通", only:"飛沙", rate:"" },
      { name:"初始之天斯卡沃", en:"", type:"野獸", only:"飛沙", rate:"" },

      { name:"菲恩絲獠牙",     en:"", type:"傳奇", only:"洞窟", rate:"" },
      { name:"菲恩絲魘甲",     en:"", type:"傳奇", only:"洞窟", rate:"" },
      { name:"菲恩絲夜織",     en:"", type:"傳奇", only:"洞窟", rate:"" },
      { name:"菲恩絲刺靴",     en:"", type:"傳奇", only:"洞窟", rate:"" },
      { name:"菲恩絲魔符",     en:"", type:"普通", only:"洞窟", rate:"" },
      { name:"初始之夜菲恩絲", en:"", type:"野獸", only:"洞窟", rate:"" },

      { name:"奎爾珊畸面",     en:"", type:"傳奇", only:"深潭", rate:"" },
      { name:"奎爾珊硬甲",     en:"", type:"傳奇", only:"深潭", rate:"" },
      { name:"奎爾珊堅鉗",     en:"", type:"傳奇", only:"深潭", rate:"" },
      { name:"奎爾珊之跡",     en:"", type:"傳奇", only:"深潭", rate:"" },
      { name:"奎爾珊魔符",     en:"", type:"普通", only:"深潭", rate:"" },
      { name:"初始之潭奎爾珊", en:"", type:"野獸", only:"深潭", rate:"" },

      { name:"自然組織",       en:"", type:"傳奇", rate:"" },
      { name:"枯井",           en:"", type:"傳奇", rate:"" },
      { name:"夜守",           en:"", type:"傳奇", rate:"" },
      { name:"瑞佛詛咒",       en:"", type:"傳奇", rate:"" },
      { name:"巨狼之眼",       en:"", type:"傳奇", rate:"" },
    ],
  },
  {
    name: "深淵聯盟(v3.1)",
    group: "",
    img: "",
    note: "",

    tiers: [
      { name:"1", title:"黯光諸侯阿姆那姆" },
      { name:"2", title:"虎勢領主烏拉曼" },
    ],

    entry: [
    ],

    drops: [
    { name:"光明獵盜者",       en:"", type:"傳奇", only:"1", rate:"30%+1%",  note:"2種", variants:["01","02"] },
      { name:"陵拳",             en:"", type:"傳奇", only:"1", rate:"27%+1%",  note:"2種", variants:["01","02"] },
      { name:"布巴尼克的線索",   en:"", type:"傳奇", only:"1", rate:"27%+1%",  note:"2種", variants:["01","02"] },
      { name:"晦暗的屍布",       en:"", type:"傳奇", only:"1", rate:"3%+0.2%", note:"2種", variants:["01","02"] },
      { name:"阿姆那姆的邪眼",   en:"", type:"珠寶", only:"1", rate:"2.5%" },
      { name:"柯戈的邪眼",       en:"", type:"珠寶", only:"1", rate:"2.5%" },
      { name:"特克羅德的邪眼",   en:"", type:"珠寶", only:"1", rate:"2.5%" },
      { name:"烏拉曼的邪眼",     en:"", type:"珠寶", only:"1", rate:"2.5%" },
      { name:"澤洛斯的惡意之眼", en:"", type:"通貨", only:"1", rate:"20%" },
      { name:"夜惡降臨",         en:"", type:"傳奇", only:"1", rate:"50%" },
      { name:"冥河腰帶",         en:"", type:"傳奇", only:"1", rate:"100%" },

    { name:"光明獵盜者",       en:"", type:"傳奇", only:"2", rate:"30%+1%",  note:"2種", variants:["01","02"] },
      { name:"陵拳",             en:"", type:"傳奇", only:"2", rate:"27%+1%",  note:"2種", variants:["01","02"] },
      { name:"布巴尼克的線索",   en:"", type:"傳奇", only:"2", rate:"27%+1%",  note:"2種", variants:["01","02"] },
      { name:"晦暗的屍布",       en:"", type:"傳奇", only:"2", rate:"3%+0.2%", note:"2種", variants:["01","02"] },
      { name:"阿姆那姆的邪眼",   en:"", type:"珠寶", only:"2", rate:"2.5%" },
      { name:"柯戈的邪眼",       en:"", type:"珠寶", only:"2", rate:"2.5%" },
      { name:"特克羅德的邪眼",   en:"", type:"珠寶", only:"2", rate:"2.5%" },
      { name:"烏拉曼的邪眼",     en:"", type:"珠寶", only:"2", rate:"2.5%" },
      { name:"澤洛斯的強權之眼", en:"", type:"通貨", only:"2", rate:"20%" },
      { name:"夜惡降臨",         en:"", type:"傳奇", only:"2", rate:"50%" },
      { name:"冥河腰帶",         en:"", type:"傳奇", only:"2", rate:"100%" },
    ],
  },
  {
    name: "裂痕君王(v2.5)",
    group: "",
    img: "",
    note: "掉落上百種穢生傳奇（Vestigial Unique），種類依放入的傳奇和霧影水晶而定，數量太多不逐一列出。",
    link: "https://pob.codes/tools/vestigialuniques/",

    tiers: [
      "昔之托沃",
      "昔之艾許",
    ],

    entry: [
      { name:"巢裔主腦腺體", count:1, only:"昔之托沃" },
      { name:"巢裔主腦腺體", count:1, only:"昔之艾許" },
    ],
  },

  {
    name: "花園王",
    group: "",
    img: "",
    note: "",

    tiers: [
      "奧莎比",
      "終極伊澤洛",
    ],

    entry: [
      { name:"神聖之花", count:1, only:"奧莎比" },

      { name:"女神之贈", count:1, only:"終極伊澤洛" },
      { name:"女神奉獻", count:1, only:"終極伊澤洛" },
      { name:"女神獻禮", count:1, only:"終極伊澤洛" },
    ],

    drops: [
      { name:"悖逆審訊",     en:"", type:"傳奇", only:"奧莎比", rate:"" },
      { name:"禁忌軍帽",     en:"", type:"傳奇", only:"奧莎比", rate:"" },
      { name:"野性法則",     en:"", type:"傳奇", only:"奧莎比", rate:"" },
      { name:"獵巫者的審判", en:"", type:"傳奇", only:"奧莎比", rate:"" },
    ],
  },

  {
    name: "阿茲里",
    group: "",
    img: "",
    note: "",

    tiers: [
      "一般",
      { name:"終極", title:"終極阿茲里 Lv.80" },
    ],

    entry: [
      { name:"黃昏的奉獻", count:1, only:"一般" },
      { name:"正午的奉獻", count:1, only:"一般" },
      { name:"午夜的奉獻", count:1, only:"一般" },
      { name:"黎明的奉獻", count:1, only:"一般" },

      { name:"凡人的哀傷", count:1, only:"終極" },
      { name:"凡人的無知", count:1, only:"終極" },
      { name:"凡人的憤怒", count:1, only:"終極" },
      { name:"凡人的希望", count:1, only:"終極" },
    ],

    drops: [
      { name:"阿茲里的諾言",       en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"阿茲里的金履",       en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"三體權威_3詞",       en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"多里亞尼之約",       en:"", type:"傳奇", only:"一般", rate:"",      note:"4種", variants:["暈眩","點燃","冰凍","感電"] },
      { name:"多里亞尼的幻化之杖", en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"誓約",               en:"", type:"傳奇", only:"一般", rate:"" },
      { name:"祭禮束衣",           en:"", type:"一般", only:"一般", rate:"" },
      { name:"綠門碎片",           en:"", type:"通貨", only:"一般", rate:"35%",   variants:["哀傷","憤怒","無知","希望"] },

      { name:"阿茲里的威權",       en:"", type:"傳奇", only:"終極", rate:"45%",   note:"9種", variants:["01","02","03","04","05","06","07","08","09"] },
      { name:"謎容",               en:"", type:"傳奇", only:"終極", rate:"37%" },
      { name:"三體權威_4詞",       en:"", type:"傳奇", only:"終極", rate:"6%" },
      { name:"阿茲里的捷思",       en:"", type:"傳奇", only:"終極", rate:"5%" },
      { name:"阿茲里的映照",       en:"", type:"傳奇", only:"終極", rate:"3%" },
      { name:"阿茲里的統御",       en:"", type:"傳奇", only:"終極", rate:"2%" },
      { name:"阿茲里的刑刃",       en:"", type:"傳奇", only:"終極", rate:"2%" },
      { name:"祭禮束衣",           en:"", type:"一般", only:"終極", rate:"12.5%" },
      { name:"美麗",               en:"", type:"通貨", only:"終極", rate:"12.5%" },
      { name:"瓦爾犧牲輔助",       en:"", type:"技能", only:"終極", rate:"" },
      { name:"高階施放迴響輔助",   en:"", type:"技能", only:"終極", rate:"" },
      { name:"極度癲狂",           en:"", type:"卡片", only:"終極", rate:"25%" },
      { name:"奉獻的代價",         en:"", type:"卡片", only:"終極", rate:"0.1%" },
    ],
  },

];

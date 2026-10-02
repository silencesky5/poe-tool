/* ============================================================
   聖甲蟲資料 —— 改這裡，存檔，重新整理網頁就生效。

   資料來自 poedb（117 種）。價格請自己填，格式跟野獸那份一樣。

   {
     group:"裂痕",             機制分類，會變成左邊的選單
     name:"元帥裂痕", en:"Breach Scarab of the Marshal",
     use:["效果一","效果二"],   多條效果用陣列
     limit:1,                  每張圖可放幾個
     price:12, unit:"C",       買價。unit 填 "C"（混沌）或 "D"（神聖）
                               沒填 price 會顯示「未定」
   }
   ============================================================ */

const SCARABS = [


  /* ── 伏擊 ── */
  { group:"伏擊", name:"伏擊", en:"Ambush Scarab", use:"區域含有額外 3 個保險箱", limit:3, price:1.22, unit:"C" },
  { group:"伏擊", name:"暗室伏擊", en:"Ambush Scarab of Hidden Compartments", use:"區域內的保險箱有 15% 機率可以開兩次", limit:1, price:1.01, unit:"C" },
  { group:"伏擊", name:"洞察伏擊", en:"Ambush Scarab of Discernment", use:"區域內的保險箱有更高機率含有更稀有品種", limit:1, price:1.59, unit:"C" },
  { group:"伏擊", name:"爆發伏擊", en:"Ambush Scarab of Potency", use:"區域內的保險箱增加 75% 固定詞綴效果", limit:1, price:1.53, unit:"C" },
  { group:"伏擊", name:"遏制伏擊", en:"Ambush Scarab of Containment", use:["區域含有多個額外保險箱", "區域的敵人處於伏擊狀態"], limit:1, price:84.7, unit:"C" },

  /* ── 傭兵 ── */
  { group:"傭兵", name:"特拉特斯聖甲蟲", en:"Trarthan Scarab", use:["區域內含有一名傭兵"], limit:1, price:67.3, unit:"C" },
  { group:"傭兵", name:"意外盟友傭兵", en:"Trarthan Scarab of Surprising Alliances", use:["區域內的盜賊流亡者有 50% 機率伴隨著一名野生傭兵", "野生傭兵會根據區域內的每一名野生傭兵增加難度"], limit:1, price:67.3, unit:"C" },
  { group:"傭兵", name:"聲名傭兵", en:"Trarthan Scarab of Renown", use:"區域內找到的傭兵所裝備的所有物品皆為傳奇", limit:1, price:69.6, unit:"C" },
  { group:"傭兵", name:"萬惡傭兵", en:"Trarthan Scarab of Infamy", use:["區域內找到的傭兵為萬惡傭兵", "區域內找到的傭兵會伴隨著兩名野生傭兵"], limit:1, price:38.0, unit:"C" },

  /* ── 其他 ── */
  { group:"其他", name:"光輝風暴", en:"Scarab of Radiant Storms", use:"區域含有燦爛風暴", limit:1, },
  { group:"其他", name:"右旋", en:"Scarab of the Dextral", use:["增加100%區域的後綴效果", "區域的前綴沒有效果"], limit:1, price:5.82, unit:"C" },
  { group:"其他", name:"妖精", en:"Scarab of Wisps", use:"怪物有機率受到 2000 個荒林妖精強化", limit:2, price:16.9, unit:"C" },
  { group:"其他", name:"左旋", en:"Scarab of the Sinistral", use:["增加100%區域的前綴效果", "區域的後綴沒有效果"], limit:1, price:5.64, unit:"C" },
  { group:"其他", name:"指揮官", en:"Scarab of the Commander", use:"完成地圖時獲得 1 個額外基拉克任務", limit:1, },
  { group:"其他", name:"敵手", en:"Scarab of Adversaries", use:"區域含有額外 4 群反射的稀有怪物", limit:2, price:1.15, unit:"C" },
  { group:"其他", name:"畸形血脈", en:"Scarab of Monstrous Lineage", use:"增加 40% 魔法怪物群大小", limit:2, price:3.89, unit:"C" },
  { group:"其他", name:"神聖", en:"Scarab of Divinity", use:["區域內最多會有 3 個額外帶有眾神之觸的稀有怪物", "帶有眾神之觸的怪物所召喚的映像增加 100% 造成的傷害"], limit:3, price:0.31, unit:"C" },
  { group:"其他", name:"穩定", en:"Scarab of Stability", use:"使用時有 50% 機率不消耗通往區域的傳送門", limit:1, price:0.97, unit:"C" },
  { group:"其他", name:"通緝叛徒", en:"Scarab of Hunted Traitors", use:"區域含有多個受通緝的背叛者", limit:1, },
  { group:"其他", name:"進化", en:"Scarab of Evolution", use:"區域內 10 個怪物群升級為魔法怪物", limit:1, },

  /* ── 凋落 ── */
  { group:"凋落", name:"凋落", en:"Blight Scarab", use:"區域內包含 1 個凋落事件", limit:1, price:0.3, unit:"C" },
  { group:"凋落", name:"振奮凋落", en:"Blight Scarab of Invigoration", use:["區域內每個賦予塔使範圍內", "凋落的怪物增加難度和獎勵"], limit:1, price:1.0, unit:"C" },
  { group:"凋落", name:"枯萎之心凋落", en:"Blight Scarab of the Blightheart", use:["區域內的凋落事件會掉落一個凋落保險箱", "區域內的凋落事件會生成更多波的敵人", "區域內的凋落保險箱會隨著", "擊殺的敵人變得更大，獎勵變得更豐富"], limit:1, price:1.0, unit:"C" },
  { group:"凋落", name:"綻放凋落", en:"Blight Scarab of Blooming", use:["區域內的凋落事件額外含有最多 3 個傳奇頭目", "凋落事件中的傳奇敵人生命增加 100%", "區域內找到的階級 14 以上凋落地圖掉落為凋落蔓延地圖"], limit:1, price:12.1, unit:"C" },

  /* ── 卡爾葛 ── */
  { group:"卡爾葛", name:"卡爾葛", en:"Kalguuran Scarab", use:"區域含有 1 個額外礦床", limit:2, price:5.01, unit:"C" },
  { group:"卡爾葛", name:"守衛財寶卡爾葛", en:"Kalguuran Scarab of Guarded Riches", use:"區域內守衛礦床的怪物至少為魔法", limit:1, price:0.37, unit:"C" },
  { group:"卡爾葛", name:"富裕卡爾葛", en:"Kalguuran Scarab of Enriching", use:["增加看守礦床的怪物的難度和獎勵", "每完成區域內的一座其他礦床", "即增加15%礦床的難度和獎勵", "特拉特斯聖甲蟲", "區域內含有一名傭兵"], limit:1, price:3.11, unit:"C" },
  { group:"卡爾葛", name:"精化卡爾葛", en:"Kalguuran Scarab of Refinement", use:"區域內礦床賦予冶鍊金屬條而非印記礦石", limit:1, price:26.7, unit:"C" },

  /* ── 反叛 ── */
  { group:"反叛", name:"不滅之火反叛", en:"Betrayal Scarab of the Allflame", use:"區域內由不滅之火餘燼替換的怪物增加 75% 數量", limit:1, price:0.62, unit:"C" },
  { group:"反叛", name:"催堅反叛", en:"Betrayal Scarab of Unbreaking", use:["區域內被審問的永生密教成員有50%機率", "在審問完畢後不降低階級"], limit:2, price:2.99, unit:"C" },
  { group:"反叛", name:"反叛", en:"Betrayal Scarab", use:"區域含有瓊恩", limit:1, price:1.05, unit:"C" },
  { group:"反叛", name:"支援反叛", en:"Betrayal Scarab of Reinforcements", use:"區域內的永生密教成員增加 50% 有支援的機率", limit:1, price:1.61, unit:"C" },

  /* ── 命運 ── */
  { group:"命運", name:"富饒命運", en:"Divination Scarab of Plenty", use:["區域含有額外 6 至 10 個命運之觸魔法怪物群，", "其增加 1000% 掉落命運卡的機率"], limit:5, price:3.26, unit:"C" },
  { group:"命運", name:"盜竊命運", en:"Divination Scarab of Pilfering", use:["最終地圖頭目會偷走區域內掉落的命運卡", "該名最終地圖頭目會根據偷取的命運卡數量", "變得更難對付並造成更多傷害", "擊敗該名最終地圖頭目時，被偷取的命運卡會以 2 倍的數量掉落"], limit:1, price:49.9, unit:"C" },
  { group:"命運", name:"迴廊命運", en:"Divination Scarab of The Cloister", use:["區域內含有額外 8 至 12 群德瑞的信徒", "德瑞的信徒有額外 1% 的機率會掉落豐裕牌組"], limit:5, price:14.5, unit:"C" },

  /* ── 感染 ── */
  { group:"感染", name:"塑界感染", en:"Influencing Scarab of the Shaper", use:"附加塑界者勢力至區域", limit:1, price:0.51, unit:"C" },
  { group:"感染", name:"尊師感染", en:"Influencing Scarab of the Elder", use:"附加異界尊師勢力至區域", limit:1, price:0.47, unit:"C" },
  { group:"感染", name:"干預感染", en:"Influencing Scarab of Interference", use:["地圖頭目會伴隨著一名隨機的塑者守護者、尊師守護者、征服者、或追憶頭目", "僅可於階級 14 以上的地圖使用"], limit:1, price:9.74, unit:"C" },
  { group:"感染", name:"群集感染", en:"Influencing Scarab of Hordes", use:"區域內的勢力怪物增加 40% 怪物群大小", limit:1, price:1.56, unit:"C" },

  /* ── 戰亂 ── */
  { group:"戰亂", name:"寶藏戰亂", en:"Legion Scarab of Treasures", use:["區域內的軍團寶箱在從凝滯狀態被釋放時", "有20%機率會擴散其獎勵至周遭的軍團怪物上", "以此方式獲得獎勵的軍團怪物會增加難度"], limit:3, price:1.55, unit:"C" },
  { group:"戰亂", name:"幹部戰亂", en:"Legion Scarab of Officers", use:"區域內的軍團派別內含 5 個額外中士", limit:1, price:3.54, unit:"C" },
  { group:"戰亂", name:"戰亂", en:"Legion Scarab", use:"區域內包含 1 個額外戰亂事件", limit:5, price:1.18, unit:"C" },
  { group:"戰亂", name:"永恆鬥爭戰亂", en:"Legion Scarab of Eternal Conflict", use:["區域內軍團怪物可以多次脫離靜止狀態", "區域內軍團怪物每次脫離都會增加難度和獎勵"], limit:1, price:390.0, unit:"C" },

  /* ── 探險 ── */
  { group:"探險", name:"尋符探險", en:"Expedition Scarab of Runefinding", use:["區域內的探險事件增加 100%", "魔符怪物標記的數量"], limit:2, price:0.56, unit:"C" },
  { group:"探險", name:"探險", en:"Expedition Scarab", use:"區域內包含 1 個額外探險事件", limit:1, price:0.26, unit:"C" },
  { group:"探險", name:"注能探險", en:"Expedition Scarab of Infusion", use:["區域內找到的探險日誌總是擁有4條固定詞綴", "探險的怪物根據引爆的遺物數量增加難度和獎勵"], limit:1, price:1.33, unit:"C" },
  { group:"探險", name:"維里西姆粉末探險", en:"Expedition Scarab of Verisium Powder", use:["區域內探險事件的炸藥增加 50% 數量", "增加 80% 爆炸範圍"], limit:1, price:0.74, unit:"C" },
  { group:"探險", name:"考古探險", en:"Expedition Scarab of Archaeology", use:"區域內的探險事件的遺跡內含 2 個額外後綴與前綴", limit:1, price:1.07, unit:"C" },

  /* ── 支配 ── */
  { group:"支配", name:"惡懼支配", en:"Domination Scarab of Terrors", use:["區域內的神殿由一個額外地圖頭目看守", "最終地圖頭目的詞綴也會套用到這些守衛身上"], limit:1, price:12.1, unit:"C" },
  { group:"支配", name:"支配", en:"Domination Scarab", use:"區域內含有 3 個額外神殿", limit:4, price:1.77, unit:"C" },
  { group:"支配", name:"映像支配", en:"Domination Scarab of Apparitions", use:"區域內含有 2 個額外映像神殿", limit:1, price:0.58, unit:"C" },
  { group:"支配", name:"進化支配", en:"Domination Scarab of Evolution", use:"區域內含有一個額外的進化神殿", limit:2, },

  /* ── 泰坦 ── */
  { group:"泰坦", name:"傳說泰坦", en:"Titanic Scarab of Legend", use:"區域內的傳奇怪物含有 4 個額外怪物詞綴", limit:1, price:2.39, unit:"C" },
  { group:"泰坦", name:"泰坦", en:"Titanic Scarab", use:"區域內的怪物群大小每增加 1%，傳奇怪物的堅韌、傷害、物品稀有度和數量皆增加 1%", limit:1, price:0.36, unit:"C" },
  { group:"泰坦", name:"珍寶泰坦", en:"Titanic Scarab of Treasures", use:["區域內的傳奇怪物擁有額外獎勵", "增加 30% 區域內傳奇怪物的堅韌"], limit:3, price:2.68, unit:"C" },

  /* ── 深淵 ── */
  { group:"深淵", name:"伴侶深淵", en:"Abyss Scarab of the Consort", use:"區域內 1 個深淵坑洞會生成一個深淵伴侶", limit:1, price:27.0, unit:"C" },
  { group:"深淵", name:"晶石深淵", en:"Abyss Scarab of Crystals", use:"區域內不為最終的深淵坑洞會於關閉時創造一個深淵水晶", limit:1, price:1.81, unit:"C" },
  { group:"深淵", name:"深淵", en:"Abyss Scarab", use:"區域內包含 1 個額外深淵", limit:5, price:5.38, unit:"C" },
  { group:"深淵", name:"眾生深淵", en:"Abyss Scarab of Multitudes", use:"區域內的深淵裂隙每餵養 1 個靈魂，增加 100% 生成的怪物數量", limit:2, price:4.94, unit:"C" },
  { group:"深淵", name:"落降深淵", en:"Abyss Scarab of Descending", use:"區域內包含 1 個無盡深淵", limit:1, price:3.22, unit:"C" },

  /* ── 混亂 ── */
  { group:"混亂", name:"浩瀚混亂", en:"Anarchy Scarab of Gigantification", use:"區域內的野生盜賊流亡者有 30% 機率被盜賊巨人取代", limit:2, price:0.52, unit:"C" },
  { group:"混亂", name:"混亂", en:"Anarchy Scarab", use:"區域內含 4 個額外盜賊流亡者", limit:5, price:0.95, unit:"C" },
  { group:"混亂", name:"結夥混亂", en:"Anarchy Scarab of Partnership", use:"區域內的野生盜賊流亡者有 50% 機率成對出現", limit:1, price:2.53, unit:"C" },
  { group:"混亂", name:"至高混亂", en:"Anarchy Scarab of the Exceptional", use:"區域內含有一名卓越的盜賊流亡者", limit:2, },

  /* ── 犄角 ── */
  { group:"犄角", name:"傳統犄角", en:"Horned Scarab of Tradition", use:["區域內所有稀有和傳奇怪物掉落的物品都會", "被獎勵詞綴轉化"], limit:1, price:21.3, unit:"C" },
  { group:"犄角", name:"庇護犄角", en:"Horned Scarab of Preservation", use:"使用時不消耗其他的聖甲蟲", limit:1, price:835.0, unit:"C" },
  { group:"犄角", name:"復仇犄角", en:"Horned Scarab of Nemeses", use:"區域內的稀有怪物含有 2 個額外詞綴", limit:2, price:12.0, unit:"C" },
  { group:"犄角", name:"萬劫犄角", en:"Horned Scarab of Pandemonium", use:["區域內的怪物群有 15% 機率取代為隨機輿圖頭目", "適用於最終地圖頭目的詞綴也會套用在這些輿圖頭目身上"], limit:1, price:27.6, unit:"C" },
  { group:"犄角", name:"血統犄角", en:"Horned Scarab of Bloodlines", use:["區域內的魔法怪物增加 150%", "區域內的魔法怪物有1條額外詞綴"], limit:1, price:531.0, unit:"C" },
  { group:"犄角", name:"覺醒犄角", en:"Horned Scarab of Awakening", use:"階級16以上的競技場中會包含來自隨機釋界之邀的頭目", limit:1, price:55.4, unit:"C" },
  { group:"犄角", name:"閃亮犄角", en:"Horned Scarab of Glittering", use:["區域內的玩家每殺死一個怪物，物品稀有度便會增加", "，最多增加 400%，並隨時間遞減"], limit:1, price:8.6, unit:"C" },

  /* ── 獸獵 ── */
  { group:"獸獵", name:"增生獸獵", en:"Bestiary Scarab of Duplicating", use:"在區域內製造已捕捉巨獸的複製體", limit:1, price:29.2, unit:"C" },
  { group:"獸獵", name:"牧群獸獵", en:"Bestiary Scarab of the Herd", use:"含有埃哈的區域內含5隻額外紅色野獸", limit:2, price:21.5, unit:"C" },
  { group:"獸獵", name:"獸獵", en:"Bestiary Scarab", use:"區域含有埃哈", limit:1, price:0.81, unit:"C" },

  /* ── 硫酸 ── */
  { group:"硫酸", name:"煙毒硫酸", en:"Sulphite Scarab of Fumes", use:["地圖區域內掉落的硫酸釋放激怒雲霧", "感染激怒雲霧影響的怪物增加 50% 物品數量", "你的地圖中的硫酸由來自碧藍礦坑的怪物守衛著"], limit:1, price:1.08, unit:"C" },
  { group:"硫酸", name:"硫酸", en:"Sulphite Scarab", use:["區域內含尼科", "地圖擁有者獲得 150% 更多硫酸"], limit:1, price:1.37, unit:"C" },

  /* ── 祭祀 ── */
  { group:"祭祀", name:"妖精祭祀", en:"Ritual Scarab of Wisps", use:["區域內的祭祀神壇會生成一個荒林妖精", "荒林妖精會使附近的玩家增加 100% 獲得的貢禮"], limit:1, price:2.04, unit:"C" },
  { group:"祭祀", name:"揀選祭祀", en:"Ritual Scarab of Selectiveness", use:["在區域內的祭祀神壇重骰恩賜之物時，前 2 次免費", "區域內祭祀神壇允許額外重骰恩賜之物2次"], limit:2, price:1.63, unit:"C" },
  { group:"祭祀", name:"繁榮祭祀", en:"Ritual Scarab of Abundance", use:"區域內的祭祀增加 100% 恩惠", limit:2, price:11.3, unit:"C" },
  { group:"祭祀", name:"荒屍祭祀", en:"Ritual Scarab of Corpses", use:"區域內的祭祀包含額外一隻屍體可物品化的稀有怪物", limit:2, price:2.63, unit:"C" },

  /* ── 穿越 ── */
  { group:"穿越", name:"侵略穿越", en:"Incursion Scarab of Invasion", use:"區域含有額外 12 至 16 群穿越怪物", limit:3, price:0.76, unit:"C" },
  { group:"穿越", name:"時間線穿越", en:"Incursion Scarab of Timelines", use:["區域內被殺的最終建師掉落一個道具神殿", "區域內道具神廟的生成取決於現有神廟的格局，其中的房間階級為隨機"], limit:1, price:111.0, unit:"C" },
  { group:"穿越", name:"穿越", en:"Incursion Scarab", use:"區域含有艾瓦", limit:1, price:0.58, unit:"C" },
  { group:"穿越", name:"鬥士穿越", en:"Incursion Scarab of Champions", use:["區域內的穿越有35%的機率使所有怪物至少為魔法", "區域內的穿越增加15%怪物群大小"], limit:2, price:2.0, unit:"C" },

  /* ── 精髓 ── */
  { group:"精髓", name:"上升精髓", en:"Essence Scarab of Ascent", use:"區域掉落的精髓高一階", limit:1, price:5.39, unit:"C" },
  { group:"精髓", name:"穩定精髓", en:"Essence Scarab of Stability", use:["在區域內汙染精隨只會使其", "升級或轉化成其他精髓"], limit:1, price:1.7, unit:"C" },
  { group:"精髓", name:"精髓", en:"Essence Scarab", use:"區域內包含 3 個被禁錮的怪物", limit:5, price:2.66, unit:"C" },
  { group:"精髓", name:"適性精髓", en:"Essence Scarab of Adaptation", use:["區域內被禁錮的怪物脫困後使另一個被禁錮的怪物獲得一個隨機精髓詞綴", "每個精髓詞綴", "使被禁錮的怪物增加難度和獎勵"], limit:1, price:7.63, unit:"C" },
  { group:"精髓", name:"鈣化精髓", en:"Essence Scarab of Calcification", use:"受困於精髓的原生稀有怪物", limit:1, price:95.3, unit:"C" },

  /* ── 苦痛 ── */
  { group:"苦痛", name:"特異苦痛", en:"Torment Scarab of Peculiarity", use:"區域內的罪魂取代成異常型態", limit:1, price:0.4, unit:"C" },
  { group:"苦痛", name:"苦痛", en:"Torment Scarab", use:["區域被 4 個額外罪魂糾纏", "區域內的罪魂在被附身的怪物", "被擊殺時有10%機率", "會被釋放並掘出一隻被附身的怪物"], limit:2, price:0.44, unit:"C" },
  { group:"苦痛", name:"附身苦痛", en:"Torment Scarab of Possession", use:"稀有怪物有四分之一機率被最多 3 個罪魂附身", limit:3, price:0.47, unit:"C" },

  /* ── 裂痕 ── */
  { group:"裂痕", name:"元帥裂痕", en:"Breach Scarab of the Marshal", use:["區域內的不穩定裂痕含有一名頭目", "區域內的裂痕巢穴會通往巢裔要塞"], limit:1, price:11.4, unit:"C" },
  { group:"裂痕", name:"共鳴浪湧裂痕", en:"Breach Scarab of Resonant Cascade", use:["每個已開啟的不穩定裂痕會使區域內不穩定裂痕開啟和關閉速度增加 10%", "每個已開啟的不穩定裂痕", "使區域內不穩定裂痕的怪物增加難度和獎勵"], limit:1, price:37.5, unit:"C" },
  { group:"裂痕", name:"動盪裂痕", en:"Breach Scarab of Instability", use:"區域內含有2道不穩定的裂痕", limit:2, price:10.5, unit:"C" },
  { group:"裂痕", name:"怒潮裂痕", en:"Breach Scarab of the Incensed Swarm", use:["區域內艾里絲的技能會改為激怒巢裔，增加", "後續波次的難度和獎勵"], limit:1, price:6.13, unit:"C" },
  { group:"裂痕", name:"窩巢裂痕", en:"Breach Scarab of the Hive", use:"區域內含有一座裂痕巢穴", limit:1, price:0.54, unit:"C" },

  /* ── 製圖 ── */
  { group:"製圖", name:"增生製圖", en:"Cartography Scarab of the Multitude", use:["區域內含有額外 8 至 12 群", "困難和會賦予獎勵的怪物群，它們會掉落額外 300% 的地圖"], limit:3, price:3.04, unit:"C" },
  { group:"製圖", name:"惡化製圖", en:"Cartography Scarab of Escalation", use:"每個地圖詞綴影響區域增加 10% 區域內掉落地圖", limit:1, price:0.77, unit:"C" },
  { group:"製圖", name:"腐化製圖", en:"Cartography Scarab of Corruption", use:"區域內掉落的非傳奇地圖為已汙染且有 8 條詞綴", limit:1, price:10.7, unit:"C" },
  { group:"製圖", name:"風險製圖", en:"Cartography Scarab of Risk", use:"區域含有 2 個額外的隨機詞綴", limit:1, price:66.3, unit:"C" },

  /* ── 譫妄 ── */
  { group:"譫妄", name:"偏執譫妄", en:"Delirium Scarab of Paranoia", use:"區域內譫妄異域的事件額外生成 2 個獎勵類型", limit:5, price:10.4, unit:"C" },
  { group:"譫妄", name:"幻覺譫妄", en:"Delirium Scarab of Delusions", use:"區域內發現的地圖含有多層譫妄異域", limit:1, price:1.89, unit:"C" },
  { group:"譫妄", name:"狂熱譫妄", en:"Delirium Scarab of Mania", use:["區域內譫妄異域的獎勵量表填滿加快 100%", "區域內的鏡子遠方的譫妄強化比平常快 50%"], limit:2, price:1.44, unit:"C" },
  { group:"譫妄", name:"神經譫妄", en:"Delirium Scarab of Neuroses", use:["區域內譫妄異域的事件含有所有傳奇譫妄頭目", "區域內的所有譫妄獎勵記數會在擊殺傳奇譫妄頭目時+1", "限用於階級 11 以上的地圖"], limit:1, price:1.39, unit:"C" },
  { group:"譫妄", name:"譫妄", en:"Delirium Scarab", use:"此區域含有 1 個譫妄之鏡", limit:1, price:0.45, unit:"C" },

  /* ── 豐收 ── */
  { group:"豐收", name:"倍增豐收", en:"Harvest Scarab of Doubling", use:["區域內的豐收怪物掉落的生靈之力被複製", "區域內的豐收怪物增加 100% 生命"], limit:1, price:41.6, unit:"C" },
  { group:"豐收", name:"富饒豐收", en:"Harvest Scarab of Cornucopia", use:"區域內的聖殿密園只要情況允許便保證含有階級 4 種子，每種類最多 1 個", limit:1, price:85.9, unit:"C" },
  { group:"豐收", name:"豐收", en:"Harvest Scarab", use:"區域含有聖殿密園", limit:1, price:0.79, unit:"C" },

  /* ── 超越 ── */
  { group:"超越", name:"侵略超越", en:"Beyond Scarab of the Invasion", use:"區域內被殺的稀有和傳奇怪物額外創造 8 至 12 個超越傳送門", limit:1, price:3.87, unit:"C" },
  { group:"超越", name:"復興超越", en:"Beyond Scarab of Resurgence", use:["區域內的超越頭目會伴隨著其他勢力的超越頭目", "區域內的超越頭目增加 20% 掉落的玷汙的通貨", "區域內的超越傳送門增加 30% 生成一個傳奇頭目的機率"], limit:1, price:1.3, unit:"C" },
  { group:"超越", name:"血病超越", en:"Beyond Scarab of Haemophilia", use:["區域內，超越傳送門的融合範圍增加 50%", "擊殺區域內的超越怪物時有30%機率獲得其詞綴，持續20秒"], limit:2, price:1.1, unit:"C" },
  { group:"超越", name:"超越", en:"Beyond Scarab", use:"擊殺區域內的敵人將會吸引更強大的怪物登場", limit:1, price:1.03, unit:"C" },

  /* ── 通牒 ── */
  { group:"通牒", name:"催化通牒", en:"Ultimatum Scarab of Catalysing", use:["區域內的最後通牒事件僅會向地圖", "擁有者提供催化劑作為獎勵"], limit:1, price:0.98, unit:"D" },
  { group:"通牒", name:"決鬥通牒", en:"Ultimatum Scarab of Dueling", use:"區域內的通牒事件只要情況允許便保證觸發傳奇頭目", limit:1, price:31.1, unit:"C" },
  { group:"通牒", name:"賄賂通牒", en:"Ultimatum Scarab of Bribing", use:["通牒怪物增加 150% 經驗", "通牒事件給予的獎勵，有如你完成額外 2 回合"], limit:2, price:2.52, unit:"C" },
  { group:"通牒", name:"通牒", en:"Ultimatum Scarab", use:"區域內包含 1 個通諜事件", limit:1, price:0.78, unit:"C" },
  { group:"通牒", name:"銘文通牒", en:"Ultimatum Scarab of Inscription", use:["區域內的最後通牒事件獎勵將從催化劑改為", "給予地圖主辦人最後通牒雕刻"], limit:1, price:3.35, unit:"C" },

];

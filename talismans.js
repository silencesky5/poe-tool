/* ============================================================
   魔符資料 —— 改這裡，存檔，重新整理網頁就生效。

   ── 格式 ─────────────────────────────────────
   {
     name:  "龐然魔符",
     use:   "增加 15% 最大生命",     效果，也可以用陣列寫多條
     price: 80, unit:"C",           unit 填 "C"（混沌）或 "D"（神聖）
     group: "防禦",                 選填。有填的話左邊會出現分類選單
     note:  "備註",                 選填
   }

   價格不確定就整個不要寫 price，那一欄會顯示「未定」。
   ============================================================ */

const TALISMANS = [

  { name:"龐然魔符",     use:"增加 15% 最大生命", price:80, unit:"C" },
  { name:"巨人魔符",     use:"投射物穿透 3 個額外目標", price:3, unit:"C" },
  { name:"恐喙鳥魔符",   use:"獲得等同 15% 最大生命值的額外護甲", price:10, unit:"C" },
  { name:"血蛇魔符",     use:"增加 20% 冷卻時間恢復率", price:2, unit:"C" },
  { name:"龍蜥魔符",     use:"增加 30% 投射物速度", price:1, unit:"C" },
  { name:"烏賊魔符",     use:"增加 30% 最大魔力", price:4, unit:"C" },
  { name:"噴砂爪蟹魔符", use:"增加 12% 移動速度", price:1, unit:"C" },
  { name:"盾螯魔符",     use:"增加 30% 全域防禦", price:5, unit:"C" },
  { name:"羊人魔符",     use:"擊中無視敵人怪物物理傷害減免", price:5, unit:"C" },
  { name:"吞噬者魔符",   use:"傷害穿透 15% 火焰抗性", price:1, unit:"C" },
  { name:"瘟疫毒蛛魔符", use:"增加 35% 凋零效果", price:20, unit:"C" },
  { name:"觀察者魔符",   use:"傷害穿透 15% 閃電抗性", price:2, unit:"C" },
  { name:"殘暴蟹魔符",   use:"傷害穿透 15% 冰冷抗性", price:1, unit:"C" },
  { name:"烈炎地獄犬魔符", use:"+4% 最大火焰抗性", price:10, unit:"C" },
  { name:"冰霜犬魔符",   use:"+4% 最大冰冷抗性", price:3, unit:"C" },
  { name:"山貓魔符",     use:"+4% 最大閃電抗性", price:3, unit:"C" },
  { name:"靈猴魔符",     use:"+1 最小耐力、狂怒和暴擊球", price:9, unit:"C" },
  { name:"狼王魔符",     use:"+40% 全域暴擊加成", price:5, unit:"C" },
  { name:"熔犬魔符",     use:"不被點燃影響", price:1, unit:"C" },
  { name:"鬥牛犬魔符",   use:"戰吼竭盡 1 次額外攻擊", price:5, unit:"C" },
  { name:"墮落之爪魔符", use:"增加 30% 你印記的效果", price:1, unit:"C" },
  { name:"金牛人魔符",   use:"+1 最大耐力球", price:5, unit:"C" },
  { name:"反芻鳥魔符",   use:"+1 最大暴擊球", price:5, unit:"C" },
  { name:"眼鏡蛇魔符",   use:"+1 最大狂怒球", price:15, unit:"C" },
  { name:"食腐蟲后魔符", use:"+1 最大幽魂數量", price:45, unit:"C" },
  { name:"搗亂者魔符",   use:"所有捷光環技能寶石的等級 +2", price:5, unit:"C" },
  { name:"黑寡婦魔符",   use:"每 3 秒功能藥劑回復 2 充能", price:5, unit:"C" },
  { name:"毒蠍魔符",     use:"+20% 持續傷害加成", price:1, unit:"C" },
  { name:"猛虎魔符",     use:"增加 8% 行動速度", price:8, unit:"C" },
  { name:"禿鷹魔符",     use:"技能發射 1 個額外投射物", price:50, unit:"C" },
  { name:"雛鳥魔符",     use:"承受 100% 的擊中冰冷和閃電傷害轉換為火焰", price:3, unit:"D" },
  { name:"混血蜘蛛魔符", use:"召喚物擁有 +30% 持續傷害加成", price:10, unit:"C" },
  { name:"章魚魔符",     use:"敵人擊中你時有 20% 機率冰凍它們 1 秒", price:10, unit:"C" },
  { name:"蛛蛛蟹魔符",   use:"全部技能寶石品質 +15%", price:9, unit:"C" },
  { name:"巨口魔符",     use:"增加 15% 所有屬性", price:2, unit:"D" },
  { name:"鳴蛙魔符",     use:"全部技能寶石等級 +1", price:300, unit:"C" },
  { name:"奎爾珊魔符",   use:"增加 100% 蟹將祝福增益效果", price:100, unit:"C" },
  { name:"菲恩絲魔符",   use:"增加 100% 毒蛛祝福增益效果", price:100, unit:"C" },
  { name:"斯卡沃魔符",   use:"增加 100% 飛羽祝福增益效果", price:100, unit:"C" },
  { name:"費爾羅魔符",   use:"增加 100% 傲貓祝福增益效果", price:8, unit:"C" },
  { name:"巨狼魔符",     use:"每完成一場祭月增加 44% 傷害",
    note:"只能靠腐化巨狼之眼取得" },
  { name:"黯牙魔符",     use:"有 1 個插槽" },

];

/* 製裝模擬器的批次模擬，在背景執行，頁面不會卡住。 */
importScripts("craft-data.js","craft-engine.js");
const E=CraftEngine.create(self.CRAFT_DATA);
onmessage=e=>{
  const o=e.data, results=[];
  const step=Math.max(50,Math.floor(o.n/50));
  for(let i=0;i<o.n;i++){
    results.push(E.runOne(o,Math.random));
    if((i+1)%step===0) postMessage({progress:(i+1)/o.n});
  }
  postMessage({done:true,results});
};

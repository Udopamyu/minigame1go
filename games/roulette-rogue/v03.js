
/* ROULETTE ROGUE DX v0.2 — original offline-first long-run pixel casino. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const RED=new Set([1,4,5,8,9,12]),COLORS=["#208268","#af3d58","#283b59"];
const DISTRICTS=[
 ["ネオン横丁","#65e9e4","看板の魔女"],
 ["黄金の桟橋","#ffdc82","黄金船の船長"],
 ["地下時計塔","#b29af6","時の銀行家"],
 ["幽霊ホテル","#83ecc1","夜会の女王"],
 ["王家の最上階","#f58e91","最終支配人"]
];
const NAMES=["真夜中の配達人","黒帽子の記者","銀貨の商人","路地裏の魔術師","星を見る少女","退役の兵士","砂漠の富豪","赤髪の旅人","偽物の王子","時計職人","酔いどれ詩人","青い目の紳士","彫刻家","闇市の代理人","港町の船乗り","月光の占い師","地下の庭師","旅する歌姫","古書の番人","ガラスの剣士"];
const TRAITS=[
 ["regular","常連","標準的な客。"],["rich","富豪","賭け金が高め。"],
 ["armored","倹約家","徴収額を20%軽減する。"],["counter","反撃役","的中時の払い戻しが増える。"],
 ["greedy","強気","毎回賭け金が上昇する。"],["shield","護衛付き","最初の負けを40%軽減。"],
 ["ghost","怪盗","0番に出ると銀行から15奪う。"],["mirror","鏡使い","数字をずらすたび銀行-5。"],
 ["trickster","奇術師","相手の当たりで追加8損害。"],["collector","収集家","高額の賭けを続ける。"]
];
const BETS={
 red:["赤 RED",n=>RED.has(n)],black:["黒 BLACK",n=>n>0&&!RED.has(n)],
 odd:["奇数 ODD",n=>n>0&&n%2!==0],even:["偶数 EVEN",n=>n>0&&n%2===0],
 high:["大 HIGH",n=>n>=7],low:["小 LOW",n=>n>0&&n<=6]
};
const PERKS=[
 // 28 pocket cards. Every one has a distinct numerical or conditional effect.
 ["p01","鉄の徴収機","▣","slot","drain",11,"この番号で客-11"],
 ["p02","二枚刃","✂","slot","drain",21,"この番号で客-21"],
 ["p03","黄金の床","★","slot","bank",20,"この番号で銀行+20"],
 ["p04","大金庫","▤","slot","bank",36,"この番号で銀行+36"],
 ["p05","吸収弁","◈","slot","drain",17,"この番号で客-17"],
 ["p06","錆の罠","☠","slot","poison",7,"この番号で客を毒状態にする"],
 ["p07","無効化の旗","⚑","slot","flip",0,"この番号では的中を外れにする"],
 ["p08","鉄壁マス","◇","slot","guard",.55,"この番号で的中の支払いを45%軽減"],
 ["p09","増殖ギア","⚙","slot","combo",8,"同じ番号の設置数×8を徴収"],
 ["p10","呼び鈴","♫","slot","nudge",1,"この番号で次のスピンのずらし+1"],
 ["p11","零の呪い","0","slot","zero",30,"0番に置くと客-30。他は-8"],
 ["p12","複利の穴","◆","slot","grow",7,"発動するたび徴収額が7増える"],
 ["p13","隣接の刺客","✣","slot","adjacent",8,"前後の番号でも客-8"],
 ["p14","紙幣の泉","♜","slot","bank",27,"この番号で銀行+27"],
 ["p15","紅色の針","♥","slot","red",20,"赤い番号なら客-20"],
 ["p16","漆黒の針","♠","slot","black",20,"黒い番号なら客-20"],
 ["p17","端数徴収","₿","slot","fraction",.12,"財布残金の12%を徴収"],
 ["p18","深海の針","≈","slot","fraction",.20,"財布残金の20%を徴収"],
 ["p19","王家の剣","♛","slot","boss",30,"ボスなら客-30、それ以外-12"],
 ["p20","火花の床","✦","slot","drain",28,"この番号で客-28"],
 ["p21","奇数の罠","Ⅰ","slot","odd",24,"奇数なら客-24"],
 ["p22","偶数の罠","Ⅱ","slot","even",24,"偶数（0以外）なら客-24"],
 ["p23","保険の鍵","✚","slot","shield",20,"この番号で銀行シールド+20"],
 ["p24","賭博の嵐","✹","slot","gamble",40,"銀行-8と引換えに客-40"],
 ["p25","流星の床","✳","slot","bank",50,"この番号で銀行+50"],
 ["p26","終末の紋章","☾","slot","ramp",13,"幕の数×13を徴収"],
 ["p27","盗賊王","♕","slot","fraction",.30,"財布残金の30%徴収"],
 ["p28","伝説の金庫","▥","slot","bank",80,"この番号で銀行+80"],
 // 28 global, with different triggers; some rare items only appear in later acts.
 ["g01","入場料","⊕","global","entry",15,"新規客の財布から15徴収"],
 ["g02","サービス料金","▤","global","fee",5,"各スピンに+5徴収"],
 ["g03","富の防波堤","◇","global","defend",.20,"客的中時の支払い20%軽減"],
 ["g04","赤の呪術","♥","global","red",8,"赤い番号で客-8"],
 ["g05","黒の呪術","♠","global","black",8,"黒い番号で客-8"],
 ["g06","零の献金","0","global","zero",25,"0番で客-25"],
 ["g07","ゼロ磁石","◎","global","magnet",2.3,"0番の出現率を約2.3倍にする"],
 ["g08","熟練の指","↔","global","nudge",1,"毎スピンのずらし回数+1"],
 ["g09","長い指","⇄","global","range",2,"一回のずらし幅が±2に"],
 ["g10","入金保障","▣","global","vault",80,"獲得時すぐ銀行+80"],
 ["g11","先制徴収","⚡","global","first",13,"客の最初のスピンで客-13"],
 ["g12","黄金の報奨","★","global","bounty",30,"客を倒すと銀行+30"],
 ["g13","後継契約","♜","global","interest",.07,"客撃破で銀行の7%を追加（上限100）"],
 ["g14","赤字保険","☂","global","defendflat",8,"的中の支払い-8"],
 ["g15","おまけ税","▥","global","miss",9,"客の外れでさらに-9"],
 ["g16","万年夜勤","☾","global","every",9,"毎スピン客-9"],
 ["g17","特別な客","♛","global","boss",22,"ボスとのスピンで客-22"],
 ["g18","不運の影","◆","global","odd",10,"奇数なら客-10"],
 ["g19","千枚の硬貨","✦","global","even",10,"偶数なら客-10"],
 ["g20","貯蓄の匠","⌂","global","onmissbank",15,"外れごとに銀行+15"],
 ["g21","配当率操作","⚖","global","defend",.3,"客的中の支払い30%軽減"],
 ["g22","予備資金","✚","global","vault",130,"獲得時すぐ銀行+130"],
 ["g23","コインの嵐","♣","global","slots",4,"設置した強化の個数×4を毎回銀行に"],
 ["g24","高級接待","♦","global","entry",30,"新規客に入場料30を課す"],
 ["g25","三段シフト","⇆","global","range",3,"一回のずらし幅が±3に"],
 ["g26","逆転徴収","↟","global","laststand",20,"銀行150未満なら毎スピン客-20"],
 ["g27","黄金の王冠","♕","global","bossbounty",110,"ボス撃破で銀行+110"],
 ["g28","王家の税関","▣","global","every",18,"毎スピン客-18"]
].map(a=>({id:a[0],name:a[1],icon:a[2],kind:a[3],op:a[4],amt:a[5],desc:a[6],rarity:/^(p(17|18|24|25|27|28)|g(22|25|27|28))$/.test(a[0])?3:/^(p(08|12|19|23|26)|g(07|09|13|17|21|26))$/.test(a[0])?2:1}));
const KEYS={meta:"minigame1go-roulette-v02-meta",run:"minigame1go-roulette-v02-run"};
function getSaved(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch(e){return fallback;}}
function putSaved(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
function clearSaved(){try{localStorage.removeItem(KEYS.run);}catch(e){}}
let meta={...{clears:0,bosses:0,bestWave:0,totalRuns:0,totalSpins:0},...getSaved(KEYS.meta,{})};
let charter="vault",run=null,overlayMode="title",offer=[],selected=null;
let spinningId=0,finalIndex=0,rotation=0,spinRaf=0,trackStars=[],soundEnabled=true,ac=null;

// House decisions and the per-spin monetary receipt are separate from the historical log.
// Numbers here are recorded from actual balance mutations, not estimates.
let receipt=null,receiptSource=null,receiptIndex=0;
function moneyRow(name,icon,delta,detail=""){
 if(!receipt||!Number.isFinite(delta)||delta===0)return;
 const source=receiptSource||{name,icon};
 receipt.rows.push({name:source.name||name,icon:source.icon||icon,delta:Math.round(delta),detail});
}
function textRow(name,icon,detail,saved=0){
 if(receipt)receipt.rows.push({name,icon,delta:0,detail,saved});
}
function traceSource(p){receiptSource=p?{name:p.name,icon:p.icon}:null;}
function moneyBank(amount,name="その他の入金",icon="¥"){
 if(!Number.isFinite(amount)||!amount)return;
 run.bank+=amount;moneyRow(name,icon,amount,"銀行への直接入金");
}
function moneyCost(amount,name,icon="◆"){
 if(!Number.isFinite(amount)||amount<=0)return;
 run.bank-=amount;moneyRow(name,icon,-amount,"胴元の支払い");
}
function tacticLabel(){
 return {steady:"堅守",greed:"強欲",precision:"精密"}[run?.tactic||"steady"];
}
function chooseTactic(tactic){
 if(!run||run.mode!=="battle"||run.phase!=="bet")return;
 if(!["steady","greed","precision"].includes(tactic))return;
 if(tactic==="precision"&&run.bank<12)return;
 run.tactic=tactic;tone("tap");render();save();
}
function chooseFocus(n){
 if(!run||run.mode!=="battle"||run.phase!=="bet"||run.bank<7)return;
 run.focus=run.focus===n?null:n;tone("nudge");burst("spark",8);render();save();
}
function assessNumber(){
 if(!run||run.phase!=="judge")return;
 const e=run.enemy,n=run.landed;
 const hit=BETS[e.bet][1](n)&&!installedAt(n).some(p=>p.op==="flip");
 const target=run.focus===n?"◆ 注目マス発動 · ":"";
 const perks=installedAt(n).map(p=>p.icon+" "+p.name).join(" / ");
 $("pred-number").textContent=n;
 $("pred-outcome").textContent=hit?"客の的中":"客のハズレ";
 $("pred-effects").textContent=target+(perks||"基本精算のみ");
 $("judge-preview").classList.toggle("good",!hit);
 $("judge-preview").classList.toggle("bad",hit);
}
function showReceipt(){
 if(!receipt)return;
 receipt.endBank=run.bank;receipt.endWallet=run.enemy.wallet;
 const accounted=receipt.rows.reduce((t,row)=>t+row.delta,0);
 const remainder=(receipt.endBank-receipt.startBank)-accounted;
 if(remainder!==0)receipt.rows.push({name:"その他の清算",icon:"◆",delta:remainder,detail:"その他の銀行資金変動"});
 if(!receipt.rows.length)textRow("収支変動なし","◇","今回、銀行資金は変化しませんでした");
 const e=run.enemy,n=run.landed;
 const hit=BETS[e.bet][1](n)&&!installedAt(n).some(p=>p.op==="flip");
 $("receipt-number").textContent=n;
 $("receipt-number").className="receipt-ball "+(n===0?"zero":RED.has(n)?"red":"black");
 $("receipt-bet").textContent="客の賭け： "+BETS[e.bet][0]+" / "+currency(receipt.stake);
 $("receipt-verdict").textContent=hit?"客が的中！":"客のハズレ！";
 $("receipt-compare").textContent=hit?"配当を支払う（マス効果は別途発動）":"客から掛け金を回収";
 $("receipt-screen").hidden=false;
 receiptIndex=0;
 renderReceipt();
}
function renderReceipt(){
 if(!receipt)return;
 const rows=receipt.rows,idx=Math.max(0,Math.min(receiptIndex,rows.length));
 const current=rows[idx===0?0:idx-1];
 const sum=rows.slice(0,idx).reduce((a,b)=>a+b.delta,0);
 $("receipt-step").textContent=idx+" / "+rows.length;
 $("receipt-meter").style.width=(idx/rows.length*100)+"%";
 const effect=$("receipt-effect");effect.style.animation="none";void effect.offsetWidth;effect.style.animation="";
 $("effect-icon").textContent=idx?current.icon:"◆";
 $("effect-title").textContent=idx?current.name:"決済の内訳を確認";
 $("effect-desc").textContent=idx?current.detail:"当たり外れ、強化、手数料をひとつずつ確認します";
 const num=$("effect-amount");num.textContent=idx?(current.saved?"防止 "+currency(current.saved):current.delta===0?"効果発動":(current.delta>=0?"+":"−")+currency(Math.abs(current.delta))):"—";
 num.classList.toggle("negative",idx&&current.delta<0);
 const net=$("receipt-net");
 net.textContent=(sum>=0?"+":"−")+currency(Math.abs(sum));
 net.classList.toggle("negative",sum<0);
 $("receipt-bank").textContent=currency(receipt.startBank)+" → "+currency(receipt.startBank+sum);
 $("receipt-next").textContent=idx>=rows.length?"✓ 結果を確認して戻る":"次の効果を見る ▶";
 $("receipt-skip").disabled=idx>=rows.length;
 $("receipt-skip").textContent=idx>=rows.length?"確認済み":"一括表示";
 let strip=$("receipt-breakdown");
 if(!strip){strip=document.createElement("div");strip.id="receipt-breakdown";strip.className="receipt-breakdown";document.querySelector(".receipt-total").before(strip);}
 strip.replaceChildren();
 for(const row of rows.slice(0,idx)){
  const chip=document.createElement("span");chip.className="effect-chip "+(row.delta<0?"negative":"");
  chip.textContent=row.icon+" "+row.name+" "+(row.saved?"防止 "+row.saved:row.delta===0?"発動":(row.delta>=0?"+":"−")+Math.abs(row.delta));
  strip.append(chip);
 }
 if(idx>0){tone(current.delta<0?"bad":current.delta>0?"good":"tap");receiptCoins(current);}
}

function receiptCoins(row){
 if(!row||!row.delta||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const host=document.querySelector(".receipt-window");
 const layer=document.createElement("div");layer.className="receipt-coins";
 const isLoss=row.delta<0;
 for(let i=0;i<13;i++){
  const chip=document.createElement("i");chip.className="flying-chip"+(isLoss?" loss":"");
  const x=((i*53+11)%83)+8,y=((i*29+13)%30)+42;
  chip.style.left=x+"%";chip.style.top=y+"%";
  chip.style.setProperty("--fly-x",((i%2?1:-1)*(18+(i*13)%72))+"px");
  chip.style.setProperty("--fly-y",(isLoss?30+(i*19)%60:-20-(i*17)%100)+"px");
  chip.style.animationDelay=(i%5)*30+"ms";layer.append(chip);
 }
 host.append(layer);
 setTimeout(()=>layer.remove(),980);
}

function nextReceipt(){
 if(!receipt)return;
 if(receiptIndex<receipt.rows.length){receiptIndex++;renderReceipt();burst("good",receipt.rows[receiptIndex-1].delta>0?12:5);return;}
 $("receipt-screen").hidden=true;receipt=null;receiptSource=null;
 render();
}
function skipReceipt(){
 if(!receipt)return;
 receiptIndex=receipt.rows.length;renderReceipt();
}
function reroll(){
 if(!run||run.mode!=="battle"||run.phase!=="judge"||run.rerolled||run.bank<22)return;
 run.rerolled=true;moneyCost(22,"再抽選費用","↻");
 run.phase="spinning";run.landed=null;tone("spin");burst("spark",22);
 let weights=Array(13).fill(1);weights[0]+=Math.max(0,passiveAmount("magnet")-1);
 let roll=rand()*weights.reduce((a,b)=>a+b,0),number=0;
 for(let i=0;i<13;i++){roll-=weights[i];if(roll<0){number=i;break;}}
 finalIndex=number;const from=rotation,to=rotation+Math.PI*2*3+locateAngle(number),start=performance.now();
 const token=++spinningId;render();
 function frame(now){if(token!==spinningId)return;const t=Math.min(1,(now-start)/890),e=1-Math.pow(1-t,3);
  rotation=from+(to-from)*e;drawWheel();if(t<1)requestAnimationFrame(frame);else{rotation=to;judge();}}
 requestAnimationFrame(frame);
}
$("receipt-next").addEventListener("click",nextReceipt);
$("receipt-skip").addEventListener("click",skipReceipt);
$("reroll").addEventListener("click",reroll);
document.querySelectorAll("[data-tactic]").forEach(btn=>btn.addEventListener("click",()=>chooseTactic(btn.dataset.tactic)));

const ROTOR=document.getElementById("wheel").getContext("2d");
const art=document.createElement("canvas");art.width=180;art.height=180;const brush=art.getContext("2d");
const dial=document.getElementById("wheel"),canvasBG=$("city"),canvasFX=$("particles"),ctxFX=canvasFX.getContext("2d");
let fxDots=[],fxRunning=false;const testMode=new URLSearchParams(location.search).get("e2e")==="1";
const palette=(n)=>n===0?COLORS[0]:RED.has(n)?COLORS[1]:COLORS[2];
function rand(){let z=run.rng>>>0;z^=z<<13;z^=z>>>17;z^=z<<5;run.rng=z>>>0;return (run.rng>>>0)/4294967296;}
function randint(max){return Math.floor(rand()*max);}
function currency(n){return "¥ "+Math.floor(n).toLocaleString("ja-JP");}
function owns(id){return !!run&&run.perks.some(p=>p.id===id);}
function getPerk(id){return PERKS.find(p=>p.id===id);}
function passives(){return run.perks.filter(x=>getPerk(x.id)?.kind==="global").map(x=>getPerk(x.id));}
function installedAt(n){return run.perks.filter(x=>x.at===n&&getPerk(x.id)?.kind==="slot").map(x=>({...getPerk(x.id),item:x}));}
function log(msg,kind=""){if(!run)return;run.logs.unshift({msg,kind});run.logs=run.logs.slice(0,25);}
function findPassive(op){return passives().filter(p=>p.op===op);}
function passiveAmount(op){return findPassive(op).reduce((sum,p)=>sum+p.amt,0);}
function save(){
 if(!run||["spinning","judge"].includes(run.phase))return;
 putSaved(KEYS.run,{version:2,run,overlayMode,offer:offer.map(p=>p.id),selected:selected?.id||null});
}
function load(){
 const v=getSaved(KEYS.run,null);
 return v&&v.version===2&&v.run&&v.run.wave<=50?v:null;
}
function tone(name){
 if(!soundEnabled)return;
 try{
  if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();
  if(ac.state==="suspended")ac.resume();
  const notes={spin:[450,610,760,920,1140,1300],stop:[810,510,300],tap:[440],
   nudge:[730,940],good:[520,710,910,1200],bad:[250,180,110],
   epic:[220,390,520,790,1040,1480],perk:[390,590,790,1180],
   boss:[130,165,220,330,490],save:[440,600],gold:[730,940,1300]};
  const scale=notes[name]||notes.tap,now=ac.currentTime;
  for(let i=0;i<scale.length;i++){
   const o=ac.createOscillator(),g=ac.createGain(),t=now+i*.084;
   o.type=name==="bad"||name==="boss"?"sawtooth":name==="spin"?"square":"triangle";
   o.frequency.setValueAtTime(scale[i],t);o.frequency.exponentialRampToValueAtTime(Math.max(scale[i]*.68,60),t+.14);
   g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.045,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+.18);
   o.connect(g).connect(ac.destination);o.start(t);o.stop(t+.19);
  }
 }catch(e){}
}
function resizeFX(){canvasFX.width=Math.max(1,Math.ceil(innerWidth/3));canvasFX.height=Math.max(1,Math.ceil(innerHeight/3));}
function burst(type,count=32){
 const r=$("wheel").getBoundingClientRect(),x=(r.x+r.width/2)/3,y=(r.y+r.height/2)/3;
 const colors=type==="bad"?["#ff577c","#ffc1bd","#f27057"]:type==="good"?["#ffe68a","#fff8ca","#e7a956"]:["#80f6ef","#ffde82","#ca92f4"];
 for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=1+Math.random()*4;
  fxDots.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,t:35+Math.random()*43,c:colors[i%colors.length],s:2+Math.random()*3|0});}
 if(!fxRunning){fxRunning=true;requestAnimationFrame(particleLoop);}
}
function particleLoop(){
 ctxFX.clearRect(0,0,canvasFX.width,canvasFX.height);
 for(const p of fxDots){p.x+=p.vx;p.y+=p.vy;p.vy+=.15;p.t--;ctxFX.globalAlpha=Math.min(1,p.t/22);
  ctxFX.fillStyle=p.c;ctxFX.fillRect(p.x|0,p.y|0,p.s,p.s);}
 ctxFX.globalAlpha=1;fxDots=fxDots.filter(p=>p.t>0);
 if(fxDots.length)requestAnimationFrame(particleLoop);else fxRunning=false;
}
function drawCity(){
 const c=canvasBG.getContext("2d"),w=320,h=180,act=run?Math.min(4,Math.floor(Math.max(0,run.wave-1)/10)):0;
 const colors=["#171e3d","#28213a","#22223e","#18293a","#331e37"];
 c.fillStyle=colors[act];c.fillRect(0,0,w,h);
 for(let i=0;i<95;i++){let x=(i*137+21)%w,y=(i*37+13)%150;c.fillStyle=i%3?"#577a8b":"#e5c78c";c.fillRect(x,y,1,1);}
 c.fillStyle="#172b42";
 for(let x=0;x<w;x+=15){const level=75+((x*7+act*11)%35);c.fillRect(x,level,12,h-level);
  c.fillStyle="#fed08b";for(let y=level+7;y<h-7;y+=10)c.fillRect(x+4,y,2,3);c.fillStyle="#172b42";}
 c.fillStyle="#6e4f37";c.fillRect(159,0,3,23);c.fillRect(110,23,102,4);
 c.fillStyle="#f1bd67";for(let i=0;i<9;i++)c.fillRect(117+i*11,26+Math.abs(4-i),4,6);
 c.fillStyle="#28374a";c.fillRect(0,155,320,25);
 c.fillStyle="#bf945e";for(let i=0;i<320;i+=16)c.fillRect(i,161,7,2);
}
function drawFace(){
 const c=$("face").getContext("2d");c.clearRect(0,0,16,16);
 const act=run?Math.min(4,Math.floor(Math.max(0,run.wave-1)/10)):0;
 const coats=["#77d8e4","#ffd184","#ab9fe8","#9cebbf","#f4849c"];
 const e=run?.enemy;const rect=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 rect("#11253c",0,0,16,16);rect(coats[act],2,11,12,5);rect("#653c48",4,3,8,5);
 rect("#f1c9a2",5,5,6,6);rect("#322a40",5,7,1,1);rect("#322a40",10,7,1,1);
 rect("#d58f85",7,9,3,1);rect("#4b314b",3,3,2,7);rect("#4b314b",11,3,2,7);
 rect("#fbddad",7,12,2,3);
 if(e?.boss){rect("#ffd77e",2,1,12,2);rect("#ffd77e",3,0,2,2);rect("#ffd77e",11,0,2,2);}
 else{rect("#eebd78",6,2,5,2);}
}
function refreshArt(){
 const c=brush;c.clearRect(0,0,180,180);const cx=90,cy=90,angStep=2*Math.PI/13;
 const slots=run?Array.from({length:13},(_,n)=>installedAt(n).length):Array(13).fill(0);
 for(let y=0;y<180;y+=2){for(let x=0;x<180;x+=2){
  const dx=x+1-cx,dy=y+1-cy,d=Math.hypot(dx,dy);
  if(d>86||d<31)continue;
  let ang=(Math.atan2(dy,dx)+Math.PI/2+Math.PI*2)%(Math.PI*2);
  const num=Math.floor(ang/angStep)%13;
  c.fillStyle=d>82?"#bd9960":d>77?"#102a37":((Math.abs(ang%angStep)<.035)?"#dbc28b":palette(num));
  c.fillRect(x,y,2,2);
  if(d>63&&d<70&&slots[num]){c.fillStyle="#ffe685";c.fillRect(x,y,2,2);}
 }}
 c.fillStyle="#0c2333";c.beginPath();c.arc(cx,cy,31,0,2*Math.PI);c.fill();
 c.strokeStyle="#e1c179";c.lineWidth=4;c.stroke();
 for(let n=0;n<13;n++){
  let a=-Math.PI/2+(n+.5)*angStep,x=cx+Math.cos(a)*54,y=cy+Math.sin(a)*54;
  c.textAlign="center";c.textBaseline="middle";c.font="bold 13px monospace";c.fillStyle="#ffffff";c.fillText(String(n),Math.round(x),Math.round(y));
 }
 drawWheel();
}
function drawWheel(){
 ROTOR.clearRect(0,0,180,180);ROTOR.imageSmoothingEnabled=false;
 ROTOR.save();ROTOR.translate(90,90);ROTOR.rotate(rotation);ROTOR.drawImage(art,-90,-90);ROTOR.restore();
 ROTOR.fillStyle="#ffe89e";ROTOR.fillRect(87,0,6,6);
}
function locateAngle(n){
 const target=-(n+.5)*2*Math.PI/13;
 const turn=2*Math.PI;const a=((rotation%turn)+turn)%turn;const b=((target%turn)+turn)%turn;
 return ((b-a+turn)%turn);
}
function spin(){
 if(!run||run.mode!=="battle"||run.phase!=="bet")return;
 receipt={startBank:run.bank,startWallet:run.enemy.wallet,stake:run.enemy.stake,
   tactic:run.tactic||"steady",focus:run.focus,rows:[]};
 if(run.tactic==="precision"){moneyCost(12,"精密作戦の費用","↔");run.nudges+=2;}
 if(run.focus!==null&&run.focus!==undefined)moneyCost(7,"注目マスの設置費","◆");
 run.rerolled=false;
 run.phase="spinning";let weights=Array(13).fill(1);weights[0]+=Math.max(0,passiveAmount("magnet")-1);
 let roll=rand()*weights.reduce((x,y)=>x+y,0),number=0;
 for(let i=0;i<13;i++){roll-=weights[i];if(roll<0){number=i;break;}}
 finalIndex=number;run.landed=null;run.turns++;run.totalSpins++;tone("spin");burst("good",9);render();
 const from=rotation,to=rotation+Math.PI*2*5+locateAngle(number),start=performance.now();
 const token=++spinningId;
 function frame(now){if(token!==spinningId)return;const p=Math.min(1,(now-start)/1550),e=1-Math.pow(1-p,4);
  rotation=from+(to-from)*e;drawWheel();
  if(p<1){spinRaf=requestAnimationFrame(frame);}else{rotation=to;judge();}}
 spinRaf=requestAnimationFrame(frame);
}
function judge(){
 if(!run||run.mode!=="battle")return;
 run.phase="judge";run.landed=finalIndex;
 tone("stop");render();assessNumber();
}
function nudge(dir){
 if(!run||run.phase!=="judge"||run.nudges<1)return;
 let span=Math.max(1,passiveAmount("range")||1);
 const delta=span*dir;run.landed=(run.landed+delta+13*5)%13;run.nudges--;
 const d=dir*span;rotation+=-d*2*Math.PI/13;drawWheel();tone("nudge");burst("spark",17);
 if(run.enemy.trait==="mirror"){moneyCost(5,"鏡使いの妨害","◈");log("鏡使い：指を使う代償 -5","minus");}
 render();
}
function debitEnemy(sum){
 if(sum<=0)return 0;
 const e=run.enemy;let value=Math.ceil(sum*(e.trait==="armored"?.8:1));
 if(e.trait==="shield"&&!e.shieldUsed){value=Math.ceil(value*.6);e.shieldUsed=true;}
 const real=Math.min(Math.max(0,e.wallet),value);
 e.wallet-=real;run.bank+=real;moneyRow("客から徴収","¥",real,"客の財布 → 胴元の銀行");return real;
}
function grantBank(sum){moneyBank(sum,"銀行ボーナス","★");}
function appliedPerks(event,n=0,hit=false){
 for(const p of passives()){
  const v=p.amt;traceSource(p);
  if(event==="new"&&p.op==="entry")debitEnemy(v);
  if(event==="miss"&&p.op==="miss")debitEnemy(v);
  if(event==="miss"&&p.op==="onmissbank")grantBank(v);
  if(event==="hit"&&p.op==="defendflat")grantBank(v);
  if(event==="after"&&p.op==="fee")debitEnemy(v);
  if(event==="after"&&p.op==="every")debitEnemy(v);
  if(event==="after"&&p.op==="red"&&RED.has(n))debitEnemy(v);
  if(event==="after"&&p.op==="black"&&n>0&&!RED.has(n))debitEnemy(v);
  if(event==="after"&&p.op==="odd"&&n>0&&n%2)debitEnemy(v);
  if(event==="after"&&p.op==="even"&&n>0&&!(n%2))debitEnemy(v);
  if(event==="after"&&p.op==="zero"&&n===0)debitEnemy(v);
  if(event==="after"&&p.op==="first"&&run.turns===1)debitEnemy(v);
  if(event==="after"&&p.op==="boss"&&run.enemy.boss)debitEnemy(v);
  if(event==="after"&&p.op==="laststand"&&run.bank<150)debitEnemy(v);
  if(event==="after"&&p.op==="slots")grantBank(run.perks.filter(o=>getPerk(o.id).kind==="slot").length*v);
  if(event==="kill"&&p.op==="bounty")grantBank(v);
  if(event==="kill"&&p.op==="interest")grantBank(Math.min(100,Math.floor(run.bank*v)));
  if(event==="kill"&&run.enemy.boss&&p.op==="bossbounty")grantBank(v);
 }
 traceSource(null);
}
function slotEffects(n,hit){
 let freeze=false,triggered=0;
 const effect=(p,adjacent=false)=>{
  const v=p.amt;triggered++;traceSource(p);
  switch(p.op){
   case "drain":debitEnemy(v);break;
   case "bank":grantBank(v);break;
   case "poison":run.poison+=2;textRow(p.name,p.icon,"毒を2ターン付与 / 次回の徴収額が増える");break;
   case "flip":freeze=true;textRow(p.name,p.icon,"この番号で客の的中を無効化");break;
   case "guard":run.payoutGuard=Math.max(run.payoutGuard,v);textRow(p.name,p.icon,"この番号の払戻額を軽減");break;
   case "combo":debitEnemy(v*installedAt(n).length);break;
   case "nudge":run.bonusNudge=Math.min(3,run.bonusNudge+v);textRow(p.name,p.icon,"次のスピンの数字操作+1");break;
   case "zero":debitEnemy(n===0?v:8);break;
   case "grow":p.item.hits=(p.item.hits||0)+1;debitEnemy(p.item.hits*v);break;
   case "adjacent":debitEnemy(v);break;
   case "red":if(RED.has(n))debitEnemy(v);break;
   case "black":if(n>0&&!RED.has(n))debitEnemy(v);break;
   case "fraction":debitEnemy(Math.ceil(run.enemy.wallet*v));break;
   case "boss":debitEnemy(run.enemy.boss?v:12);break;
   case "odd":if(n>0&&n%2)debitEnemy(v);break;
   case "even":if(n>0&&!(n%2))debitEnemy(v);break;
   case "shield":run.shield+=v;textRow(p.name,p.icon,"銀行への損害を吸収するシールド+"+v);break;
   case "gamble":moneyCost(8,p.name+"の代償",p.icon);debitEnemy(v);break;
   case "ramp":debitEnemy(Math.ceil(run.wave/10)*v);break;
  }
 traceSource(null);
 };
 for(const p of installedAt(n))effect(p);
 for(let pos of [(n+12)%13,(n+1)%13])for(const p of installedAt(pos))if(p.op==="adjacent")effect(p,true);
 if(triggered){log("数字強化 "+triggered+" 個が発動！","plus");tone("perk");burst("spark",15+triggered*10);}
 return freeze;
}
function settle(){
 if(!run||run.phase!=="judge")return;
 run.phase="result";const e=run.enemy,n=run.landed;
 // The targeted pocket is chosen by the wheel then can be shifted with limited resources.
 const hit=BETS[e.bet][1](n);
 let payout=e.stake;
 const wouldPay=hit&&!installedAt(n).some(p=>p.op==="flip");
 for(const p of passives().filter(p=>p.op==="defend")){
  const next=Math.ceil(payout*(1-p.amt));
  if(wouldPay&&payout>next)textRow(p.name,p.icon,"的中時の支払い軽減（参考額・銀行収入には含まない）",payout-next);
  payout=next;
 }
 if(e.trait==="counter"||e.trait==="trickster")payout+=8;
 if(e.boss)payout+=Math.max(5,Math.round(e.stake*.12));
 const flipped=installedAt(n).some(p=>p.op==="flip");
 const guarded=installedAt(n).some(p=>p.op==="guard");
 if(guarded){const beforeGuard=payout;payout=Math.ceil(payout*.55);
  if(wouldPay&&beforeGuard>payout)textRow("鉄壁マス","◇","マス強化による配当軽減（参考額）",beforeGuard-payout);
 }
 const standardPayout=payout;
 if(run.tactic==="steady")payout=Math.ceil(payout*.6);
 if(run.tactic==="greed")payout=Math.ceil(payout*1.5);
 if(hit&&!flipped){
  let paid=Math.max(0,payout),block=Math.min(run.shield,paid);run.shield-=block;paid-=block;
  e.wallet+=paid;run.bank-=paid;moneyRow("客への配当","▼",-paid,"的中配当 / "+tacticLabel()+"作戦");
  if(block)textRow("銀行シールド","◇","銀行の損害を防止（参考額）",block);
  if(run.tactic==="steady")textRow("堅守で支払い抑制","▣","作戦で防いだ金額（参考額・収支には含まない）",Math.max(0,standardPayout-payout));
  appliedPerks("hit",n,true);
  log("的中！ 客に "+currency(paid)+" 支払った。","minus");tone("bad");burst("bad",45);
  document.body.classList.add("flash");setTimeout(()=>document.body.classList.remove("flash"),260);
 }else{
  traceSource({name:"掛け金の回収（"+tacticLabel()+"）",icon:"◆"});
  debitEnemy(e.stake*(run.tactic==="steady"?.6:run.tactic==="greed"?1.5:1));traceSource(null);
  appliedPerks("miss",n,false);
  log("ハズレ！ 掛け金 "+currency(e.stake)+" を回収。","plus");tone("good");burst("good",28);
 }
 traceSource({name:"テーブル利用料",icon:"¥"});debitEnemy(3+(run.charter==="tax"?3:0));traceSource(null);
 if(run.poison>0){traceSource({name:"毒による追加徴収",icon:"☠"});debitEnemy(7);run.poison--;traceSource(null);}
 if(e.trait==="ghost"&&n===0){moneyCost(15,"怪盗の盗み","♠");log("怪盗が銀行から15盗んだ！","minus");}
 slotEffects(n,hit);appliedPerks("after",n,hit);
 if(run.focus===n){
   traceSource({name:"注目マスの仕込み",icon:"◆"});
   debitEnemy(28+installedAt(n).length*8);traceSource(null);
   burst("spark",45);tone("perk");
 }
 if(e.wallet<=0){
  e.done=true;run.kills++;
  let bounty=18+Math.floor(run.wave/5)*4;
  traceSource({name:"破産ボーナス",icon:"★"});grantBank(bounty);traceSource(null);appliedPerks("kill",n,hit);
  if(e.boss){meta.bosses++;putSaved(KEYS.meta,meta);burst("good",150);tone("epic");}
  log("K.O.！ 「"+e.name+"」を破産させた。報酬 "+currency(bounty),"plus");
 }else if(run.turns>=e.limit){
  e.done=true;run.escapes++;let loss=Math.max(0,12+run.act*5);
  moneyCost(loss,"客の退店ペナルティ","▼");log("客が帰った。未回収ペナルティ -"+currency(loss),"minus");
 }
 if(run.bank<=0){endRun(false);showReceipt();return;}
 render();save();showReceipt();
}
function customerAt(wave){
 const act=Math.floor((wave-1)/10),boss=wave%10===0;
 const trait=TRAITS[(wave*7+act*3)%TRAITS.length];
 const styles=[["red","black"],["odd","even"],["high","low"],["red","even","low"],["black","odd","high"],["red","black","even","odd","high","low"]];
 const wallet=(45+wave*8+act*9)*(boss?2:1);
 const stake=Math.round((12+wave*1.55+act*2)*(boss?1.35:1));
 return {name:boss?DISTRICTS[act][2]:NAMES[(wave*13+act*7)%NAMES.length],
  trait:boss?"counter":trait[0],traitName:boss?"BOSS · 高配当":trait[1],desc:boss?"追加配当を要求する強敵":trait[2],
  wallet,maxWallet:wallet,baseStake:stake,stake,limit:boss?9:5+((wave+act)%3),
  bet:null,boss,done:false,shieldUsed:false,styles:boss?styles[5]:styles[wave%styles.length]};
}
function bet(){
 const e=run.enemy;e.bet=e.styles[randint(e.styles.length)];
 e.stake=Math.min(e.wallet,e.baseStake+(e.trait==="greedy"?run.turns*4:0));
 run.nudges=1+passiveAmount("nudge")+run.bonusNudge+(run.charter==="shift"?1:0);run.tactic="steady";run.focus=null;run.rerolled=false;
 run.bonusNudge=0;
}
function newGuest(){
 if(run.wave>50){endRun(true);return;}
 run.act=Math.floor((run.wave-1)/10);
 run.enemy=customerAt(run.wave);run.turns=0;run.poison=0;run.bonusNudge=0;run.landed=null;
 run.payoutGuard=0;run.phase="bet";run.mode="battle";
 if(run.nextWeak>0){debitEnemy(run.nextWeak);run.nextWeak=0;}appliedPerks("new");bet();hideModal();drawCity();drawFace();
 log((run.enemy.boss?"◆ BOSS / ":"◆ GUEST / ")+run.wave+" : "+run.enemy.name+" 来店。");
 if(run.enemy.boss){tone("boss");burst("bad",80);}
 refreshArt();render();save();
}
function drawOptions(list,onChoose){
 const root=$("choices");root.innerHTML="";const cards=document.createElement("div");cards.className="cards";
 for(const item of list){
  const b=document.createElement("button");b.className="card";b.type="button";
  const rarity=item.rarity===3?"LEGEND":item.rarity===2?"RARE":"COMMON";
  b.innerHTML="<span class='ico'>"+item.icon+"</span><strong>"+item.name+"</strong><small>"+rarity+" / "+(item.kind==="slot"?"POCKET":"PASSIVE")+"</small><p>"+item.desc+"</p><span class='choice-foot'>選択する →</span>";
  b.onclick=()=>{tone("tap");onChoose(item);};
  cards.append(b);
 }
 root.append(cards);
}
function offerChoices(){
 let pool=PERKS.filter(p=>!owns(p.id)&&((p.rarity||1)<3||run.wave>=12));
 if(pool.length<3)pool=PERKS.filter(p=>!owns(p.id));
 const choices=[];
 while(choices.length<Math.min(3,pool.length))choices.push(pool.splice(randint(pool.length),1)[0]);
 return choices;
}
function showUpgrade(restore=false){
 run.mode="upgrade";run.phase="between";
 if(!restore)offer=offerChoices();
 showModal("UPGRADE DRAFT / 1 OF 3","ルーレットを改造","ランダムに現れる3つから1つ選べ。番号指定型は好きなマスに設置できます。",null);
 drawOptions(offer,item=>{
  if(item.kind==="slot"){selected=item;showPlacement();return;}
  acquire(item,null);newGuest();
 });
 save();
}
function acquire(p,at){
 if(run.perks.some(x=>x.id===p.id))return;
 run.perks.push({id:p.id,at,hits:0});
 if(p.op==="vault")run.bank+=p.amt;
 log("獲得：「"+p.name+"」"+(at!==null?" / "+at+"番":""),"plus");
 tone("perk");burst("spark",62);refreshArt();save();
}
function showPlacement(){
 run.mode="slot";const p=selected;
 showModal("POCKET UPGRADE","設置先を決める","「"+p.name+"」を置く番号を選んでください。既存の強化に重ねることもできます。",null);
 const grid=document.createElement("div");grid.className="placement";
 for(let n=0;n<13;n++){const b=document.createElement("button");b.type="button";
  const num=run.perks.filter(x=>x.at===n).length;b.innerHTML=String(n)+(num?"<small>強化 "+num+"</small>":"<small>空き</small>");
  b.onclick=()=>{acquire(p,n);selected=null;newGuest();};grid.append(b);}
 $("choices").append(grid);
 const back=document.createElement("button");back.className="big";back.textContent="← カード選択に戻る";
 back.onclick=()=>{selected=null;showUpgrade(true);};$("choices").append(back);save();
}
function actReward(){
 run.mode="rest";run.phase="between";
 showModal("ACT "+(run.act+1)+" CLEAR","階層突破・休憩室","ボス戦を突破しました。次の階層に備えて報酬を選んでください。",null);
 const rest=[
 {id:"heal",name:"銀行の増資",kind:"global",icon:"▣",desc:"銀行資金 +220",rarity:2},
 {id:"shield",name:"緊急金庫",kind:"global",icon:"◇",desc:"銀行防壁 +100（被害を吸収）",rarity:2},
 {id:"combo",name:"金貨の祭り",kind:"global",icon:"★",desc:"銀行資金 +110、次の客の財布-30",rarity:2}
 ];
 drawOptions(rest,p=>{if(p.id==="heal")run.bank+=220;if(p.id==="shield")run.shield+=100;
  if(p.id==="combo"){run.bank+=110;run.nextWeak=30;}
  run.wave++;run.act=Math.floor((run.wave-1)/10);drawCity();tone("epic");showUpgrade();});
 save();
}
function afterResult(){
 if(!run||run.mode!=="battle"||run.phase!=="result")return;
 if(run.enemy.done){
  if(run.wave===50){endRun(true);return;}
  if(run.wave%10===0){actReward();return;}
  run.wave++;showUpgrade();return;
 }
 run.phase="bet";run.landed=null;bet();render();save();
}
function endRun(success){
 if(!run)return;
 run.mode=success?"victory":"gameover";run.phase="finished";
 meta.totalRuns++;meta.totalSpins+=run.totalSpins;meta.bestWave=Math.max(meta.bestWave,run.wave);
 if(success)meta.clears++;putSaved(KEYS.meta,meta);clearSaved();
 tone(success?"epic":"bad");burst(success?"good":"bad",180);
 showModal(success?"ALL 5 ACTS COMPLETE":"BANK CLOSED",
  success?"王家のカジノを制覇！":"カジノが破産した",
  "到達 "+run.wave+" / 50 組 · K.O. "+run.kills+" 人 · 総回転数 "+run.totalSpins+
  "<br>最終銀行 "+currency(run.bank)+" · 全制覇 "+meta.clears+" / 6 回。", "最初から遊ぶ",()=>start());
 render();
}
function showModal(eye,title,desc,mainText,action){
 overlayMode=eye;$("eyebrow").textContent=eye;$("mtitle").textContent=title;
 $("mdesc").innerHTML=desc;$("choices").replaceChildren();$("overlay").hidden=false;
 $("modal-main").hidden=!mainText;
 if(mainText){$("modal-main").textContent=mainText;$("modal-main").onclick=action;}
 $("modal-footer").textContent="FREE · NO ADS · SAVE LOCALLY · TEST BUILD";
}
function hideModal(){$("overlay").hidden=true;}
function start(){
 clearSaved();charter=$("choices").querySelector(".active")?.dataset.key||charter;
 receipt=null;$("receipt-screen").hidden=true;run={rng:(testMode&&Number(new URLSearchParams(location.search).get("seed"))||Math.floor(Math.random()*4294967294)+1)>>>0,bank:270+Math.min(5,meta.clears)*15+(charter==="vault"?100:0),
  wave:1,act:0,enemy:null,perks:[],logs:[],phase:"between",mode:"upgrade",
  kills:0,escapes:0,turns:0,poison:0,nudges:0,bonusNudge:0,shield:0,totalSpins:0,charter,landed:null,nextWeak:0};
 tone("epic");burst("spark",100);drawCity();showUpgrade();
}
function resume(){
 const s=load();if(!s)return;
 run=s.run;receipt=null;$("receipt-screen").hidden=true;offer=(s.offer||[]).map(getPerk).filter(Boolean);selected=s.selected?getPerk(s.selected):null;
 drawCity();drawFace();refreshArt();
 if(run.mode==="upgrade")showUpgrade(true);
 else if(run.mode==="slot"&&selected)showPlacement();
 else if(run.mode==="rest")actReward();
 else if(run.mode==="battle"){if(run.phase==="spinning"||run.phase==="judge"){run.phase="bet";run.landed=null;}hideModal();}
 render();log("セーブデータを再開した。","plus");tone("save");
}
function title(){
 run=null;drawCity();refreshArt();
 showModal("WELCOME TO PIXEL CASINO","ROULETTE ROGUE DX",
 "あなたはカジノの胴元。5幕・50組の客と戦う約1時間目標のローグライク。<br>数字を改造し、金庫が破産する前に全てのボスを倒そう。","▶ NEW RUN",start);
 const wrap=document.createElement("div");wrap.className="selector";
 for(const [id,name,description] of [["vault","金庫重視","開始資金+100"],["shift","技術重視","ずらし+1"],["tax","徴収重視","毎スピン+3"]]){
  const b=document.createElement("button");b.type="button";b.dataset.key=id;
  b.innerHTML="<strong>"+name+"</strong><br>"+description;
  b.className=id===charter?"active":"";
  b.onclick=()=>{charter=id;for(const e of wrap.children)e.classList.toggle("active",e===b);tone("tap");};
  wrap.append(b);
 }
 $("choices").append(wrap);
 const prev=load();
 if(prev){const b=document.createElement("button");b.type="button";b.className="big";b.style.marginBottom="12px";
  b.textContent="▣ CONTINUE — "+prev.run.wave+" / 50組から再開";b.onclick=resume;$("choices").append(b);}
 $("modal-footer").textContent="LEGACY: "+meta.clears+"/6 RUN CLEARS · BOSS K.O. "+meta.bosses+
 " · BEST "+meta.bestWave+"/50 · AUTO SAVE / LOCAL ONLY";
 render();
}
function render(){
 if(!run){$("main").disabled=true;$("perknum").textContent="0 / "+PERKS.length;
  $("legacy").textContent="LEGACY "+meta.clears+" / 6";return;}
 const e=run.enemy,act=Math.min(4,run.act),battle=run.mode==="battle";
 $("act").textContent="ACT "+(act+1)+" / 5";$("district").textContent=DISTRICTS[act][0];
 $("road-fill").style.width=Math.min(100,run.wave/50*100)+"%";
 $("guestnum").textContent=String(run.wave).padStart(2,"0")+" / 50";
 $("legacy").textContent="LEGACY "+meta.clears+" / 6";
 $("bank").textContent=currency(run.bank);$("wallet").textContent=e?currency(e.wallet):"—";
 $("remaining").textContent=e?Math.max(0,e.limit-run.turns):"—";$("ko").textContent=run.kills;
 $("ename").textContent=e?e.name:"改造中";$("trait").textContent=e?e.traitName:"次の客を待機中";
 $("traitline").textContent=e?e.desc:"ランを開始してください。";
 $("bossmark").textContent=e?.boss?"◆ ACT BOSS ◆":"COMMON GUEST";
 document.querySelector(".enemy").classList.toggle("boss",!!e?.boss);
 $("walletfill").style.width=e?Math.max(0,Math.min(100,e.wallet/e.maxWallet*100))+"%":"0%";
 $("bet").textContent=e?.bet?BETS[e.bet][0]:"—";$("stake").textContent=e?currency(e.stake):"—";
 $("perknum").textContent=run.perks.length+" / "+PERKS.length;
 $("runinfo").textContent="TURN "+run.totalSpins+" · SHIELD "+run.shield;
 const tact=run.tactic||"steady";
 $("tactics").hidden=!battle||run.phase!=="bet";
 document.querySelectorAll("[data-tactic]").forEach(b=>{
   b.classList.toggle("selected",b.dataset.tactic===tact);
   b.disabled=!battle||run.phase!=="bet"||(b.dataset.tactic==="precision"&&run.bank<12);
 });
 $("focus-text").textContent=run.focus===null||run.focus===undefined?"未設定":run.focus+" 番";
 $("spin-feedback").textContent=run.phase==="bet"?"▶ "+tacticLabel()+" 作戦を選択中。番号選択は任意。":run.phase==="judge"?"▶ 数字をずらす／再抽選／決済を選ぼう。":"";
 $("judge-tools").hidden=!battle||run.phase!=="judge";
 $("reroll").disabled=!battle||run.phase!=="judge"||run.rerolled||run.bank<22;
 $("nudges").hidden=!battle||run.phase!=="judge";
 $("landed").textContent=run.landed===null?"—":run.landed;
 $("resultline").textContent=run.phase==="spinning"?"抽選中…":run.phase==="judge"?"数字を動かす？":run.phase==="result"?"決済完了":"結果を決めるのは指先";
 const btn=$("main");btn.disabled=!battle||run.phase==="spinning"||run.phase==="judge";
 btn.hidden=battle&&run.phase==="judge";
 btn.textContent=run.phase==="result"?(e.done?"▶ 次の客・報酬へ":"▶ 次のスピンへ"):"▶ SPIN THE WHEEL";
 $("hint").textContent=run.phase==="judge"?"ずらしは任意。決済で確定する。":run.phase==="bet"?"相手の賭けを見て回そう。ずらし "+run.nudges+" 回。":"";
 const range=Math.max(1,passiveAmount("range")||1);
 $("left").textContent="◀ -"+range;$("right").textContent="+"+range+" ▶";
 $("left").disabled=run.nudges===0;$("right").disabled=run.nudges===0;
 if(run.phase==="judge")assessNumber();
 const numbers=$("numbers");numbers.innerHTML="";
 for(let n=0;n<13;n++){const p=document.createElement("button");p.type="button";p.className="pocket "+(n===0?"zero":RED.has(n)?"red":"black")+(run.focus===n?" focused":"");p.disabled=!battle||run.phase!=="bet";
  p.textContent=n;const count=installedAt(n).length;if(count){const s=document.createElement("em");s.textContent=count;p.append(s);}
  p.title=n+"番 "+installedAt(n).map(o=>o.name).join("、");p.setAttribute("aria-pressed",String(run.focus===n));p.onclick=()=>chooseFocus(n);numbers.append(p);}
 const inventory=$("inventory");inventory.innerHTML="";
 for(const item of run.perks){const p=getPerk(item.id);if(!p)continue;
  const b=document.createElement("span");b.className="upgrade-label "+(p.kind==="slot"?"slot":"");
  b.textContent=p.icon+" "+p.name+(item.at!==null?" ["+item.at+"]":"");b.title=p.desc;inventory.append(b);}
 if(!run.perks.length)inventory.textContent="まだ強化なし";
 $("logs").innerHTML="";
 for(const it of run.logs){const p=document.createElement("p");p.className=it.kind;p.textContent=it.msg;$("logs").append(p);}
 drawFace();refreshArt();
}
$("main").onclick=()=>{if(!run||run.mode!=="battle")return;if(run.phase==="bet")spin();else if(run.phase==="result")afterResult();};
$("left").onclick=()=>nudge(-1);$("right").onclick=()=>nudge(1);$("settle").onclick=settle;
$("sound").onclick=()=>{soundEnabled=!soundEnabled;$("sound").textContent=soundEnabled?"♫ ON":"♪ OFF";$("sound").setAttribute("aria-pressed",String(soundEnabled));tone("tap");};
$("save").onclick=()=>{save();tone("save");if(run){log("セーブしました。ブラウザを閉じても再開できます。","plus");render();}};
document.addEventListener("keydown",e=>{if(e.repeat)return;if(e.code==="Space"&&e.target.tagName!=="BUTTON"){
 e.preventDefault();if(run&&run.mode==="battle"&&run.phase==="bet")spin();
 }});
window.addEventListener("resize",resizeFX);resizeFX();title();
if(testMode){
 window.__rouletteTest={
  snapshot:()=>run?{mode:run.mode,phase:run.phase,wave:run.wave,bank:run.bank,kills:run.kills,enemyWallet:run.enemy?.wallet,turns:run.turns,spinTotal:run.totalSpins,perks:run.perks.length,nudges:run.nudges,landed:run.landed}:null,
  perkIds:()=>PERKS.map(p=>p.id),
  toJudge:()=>{if(run&&run.phase==="spinning"){spinningId++;cancelAnimationFrame(spinRaf);run.landed=finalIndex;rotation+=locateAngle(finalIndex);judge();}},
  setNumber:n=>{if(run&&run.phase==="judge"){run.landed=n;drawWheel();}},
  advance:()=>{if(run?.phase==="bet")spin();if(run?.phase==="spinning"){spinningId++;cancelAnimationFrame(spinRaf);run.landed=finalIndex;judge();}},
  hasSave:()=>!!load(),
  givePerk:(id,at=null)=>{const p=getPerk(id);if(p){if(owns(id))run.perks.find(x=>x.id===id).at=at;else acquire(p,at);render();}},
  receipt:()=>receipt?{rows:receipt.rows,start:receipt.startBank,end:receipt.endBank,index:receiptIndex}:null
 };
}
})();


(function(){
'use strict';
const W=1000,H=590,TAU=Math.PI*2,canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const SLOT={weapon:'WEAPON / 武器',armor:'ARMOR / 装甲',legs:'LEGS / 脚部',core:'CORE / コア'};
const DEF={
 weapon:[
  {id:'pulse',name:'パルスガン',detail:'連射に優れる標準銃',damage:14,cool:.32,velocity:810,count:1,spread:0,mag:12,reload:1.6,idealRange:345,color:'#63eff3'},
  {id:'shot',name:'スプレッド砲',detail:'近距離で強烈な散弾',damage:8,cool:.78,velocity:740,count:5,spread:.19,mag:5,reload:2.35,idealRange:190,color:'#ffce78'},
  {id:'rail',name:'レールランサー',detail:'壁を貫くが低火力・遅い連射',damage:18,cool:1.35,velocity:1160,count:1,spread:0,mag:3,reload:3.2,idealRange:485,color:'#c1acff',pierce:true},
  {id:'missile',name:'ホーミング弾',detail:'追尾する低速ミサイル',damage:25,cool:1.02,velocity:425,count:1,spread:0,mag:4,reload:2.75,idealRange:400,color:'#ff867d',homing:true},
  {id:'micro',name:'ニードルガン',detail:'低威力・高速連射',damage:7,cool:.19,velocity:960,count:1,spread:.015,mag:30,reload:2.15,idealRange:295,color:'#82f5bb'},
  {id:'burst',name:'バーストライフル',detail:'3発同時射撃の中距離型',damage:8,cool:.62,velocity:920,count:3,spread:.072,mag:9,reload:2.35,idealRange:345,color:'#8ab5fa'},
  {id:'slug',name:'グラビティスラグ',detail:'遅い連射の一撃重視型',damage:49,cool:1.5,velocity:950,count:1,spread:0,mag:3,reload:2.9,idealRange:375,color:'#e5bcff'}
 ],
 armor:[
  {id:'mesh',name:'メッシュ装甲',detail:'軽量で基本的な防御',hp:125,guard:.025,color:'#65e1e9'},
  {id:'plated',name:'プレート装甲',detail:'高耐久の積層プレート',hp:158,guard:.065,color:'#91acd0'},
  {id:'fortress',name:'フォートレス',detail:'重装甲と厚いシールド',hp:184,guard:.105,color:'#f5b56e'},
  {id:'reactive',name:'リアクティブ装甲',detail:'反応装甲で被弾を軽減',hp:147,guard:.15,color:'#bc98f6'},
  {id:'composite',name:'コンポジット装甲',detail:'重さと防御力のバランス',hp:168,guard:.09,color:'#9dbdb2'},
  {id:'feather',name:'フェザー装甲',detail:'軽装甲・機動型ビルド向け',hp:118,guard:.045,color:'#c4d5f1'},
  {id:'prism',name:'プリズム装甲',detail:'最大HPより被弾軽減を重視',hp:136,guard:.18,color:'#a2e5f4'}
 ],
 legs:[
  {id:'wheel',name:'ローラー脚',detail:'安定した移動性能',speed:223,dash:2.8,color:'#74dce0'},
  {id:'booster',name:'ブースター脚',detail:'高機動・素早い回避',speed:262,dash:2.5,color:'#ffca80'},
  {id:'tank',name:'キャタピラ脚',detail:'低速だが耐久補助',speed:184,dash:3.0,bonusHp:18,color:'#c4b89a'},
  {id:'spider',name:'スパイダー脚',detail:'小回りの効く俊敏型',speed:246,dash:2.1,color:'#d0a7fa'},
  {id:'jet',name:'ジェット脚',detail:'直進速度が高い軽量型',speed:278,dash:2.35,color:'#f7ab84'},
  {id:'crawler',name:'ヘビークローラー',detail:'頑丈だが低速、HP増加',speed:180,dash:3,bonusHp:33,color:'#b4bfa2'},
  {id:'ranger',name:'レンジャー脚',detail:'回避と速度の中間',speed:252,dash:2.25,color:'#89d1fb'}
 ],
 core:[
  {id:'spark',name:'スパークコア',detail:'バランスのよい動力源',damage:1.03,rate:1.04,heal:0,color:'#71f3d0'},
  {id:'blaze',name:'ブレイズコア',detail:'一撃の威力を増幅',damage:1.23,rate:.93,heal:0,color:'#ff9d79'},
  {id:'rapid',name:'ラピッドコア',detail:'連射性能を大幅強化',damage:.94,rate:1.32,heal:0,color:'#9cdafa'},
  {id:'repair',name:'リペアコア',detail:'勝利時に追加回復',damage:1,rate:1,heal:.18,color:'#c5a6f8'},
  {id:'capacitor',name:'キャパシタコア',detail:'連射と火力を少し増強',damage:1.08,rate:1.13,heal:0,color:'#a5e2ff'},
  {id:'aegis',name:'イージスコア',detail:'攻撃力を抑えてダメージ軽減',damage:.96,rate:1,heal:0,guardBonus:.055,color:'#b3edb6'},
  {id:'salvager',name:'サルベージコア',detail:'勝利後の回復をさらに増強',damage:.98,rate:.98,heal:.12,color:'#f4d08d'}
 ]
};
const WEAPON_TRAITS={
 pulse:{name:'感電',stun:.14,slow:.45},
 shot:{name:'吹き飛ばし',push:30},
 rail:{name:'装甲破砕',sunder:1.5},
 missile:{name:'爆風',splash:68},
 micro:{name:'装甲削り',sunder:1.25},
 burst:{name:'炎上',burn:1.65},
 slug:{name:'強制停止',stun:.42,push:64}
};
const RAR=['','STANDARD','ADVANCED','RARE','LEGEND'],RARCOL=['','#a9bbc9','#65dece','#b9a5ff','#ffca7b'];
const part=(slot,id,lv=1,tier=1)=>({slot,id,lv,tier});
const find=p=>DEF[p.slot].find(d=>d.id===p.id)||DEF[p.slot][0];
const clone=p=>({slot:p.slot,id:p.id,lv:p.lv,tier:p.tier});
const score=p=>p.lv*(1+.23*(p.tier-1));
const rarity=wave=>{const r=Math.random();return r<Math.max(.02,(wave-8)*.025)?4:r<Math.min(.38,.04+wave*.021)?3:r<Math.min(.66,.16+wave*.034)?2:1};
const enemyNames=['NEON JACKAL','IRON MOTH','RUST VIPER','VOID CAT','DUST HOUND','SKY MANTIS','STEEL GHOST','COBALT FOX'];
// Tactical roles alter positioning and aiming without adding raw damage.
const ENEMY_ROLES={
 skirmisher:{label:'SKIRMISHER',distance:265,strafe:.8,speed:1,accuracy:1,attackRange:700},
 charger:{label:'CHARGER',distance:152,strafe:.25,speed:1.05,accuracy:1.1,attackRange:680},
 sniper:{label:'SNIPER',distance:410,strafe:.35,speed:.86,accuracy:.65,attackRange:820},
 flanker:{label:'FLANKER',distance:290,strafe:1.25,speed:1.08,accuracy:1.25,attackRange:730},
 guardian:{label:'GUARDIAN',distance:250,strafe:.55,speed:.9,accuracy:.85,attackRange:730},
 boss:{label:'OMEGA',distance:280,strafe:.75,speed:1,accuracy:.88,attackRange:790}
};
const NORMAL_ROLES=['skirmisher','charger','sniper','flanker'];
const chooseEnemyRole=kind=>kind==='boss'?'boss':kind==='elite'?'guardian':pick(NORMAL_ROLES);
// Enemy archetypes bias two slots toward recognisable combat styles.
// The other two slots, all levels and rarities remain random. Roughly
// one quarter of enemies are completely random to preserve roguelite variety.
const ENEMY_ARCHETYPES=[
 {id:'voltage-hound',role:'skirmisher',parts:{weapon:'pulse',core:'spark'}},
 {id:'ion-jackal',role:'skirmisher',parts:{weapon:'pulse',core:'capacitor'}},
 {id:'shock-sentinel',role:'guardian',parts:{armor:'prism',core:'spark'}},
 {id:'scatter-raider',role:'charger',parts:{weapon:'shot',legs:'jet'}},
 {id:'crawler-titan',role:'guardian',parts:{armor:'fortress',legs:'crawler'}},
 {id:'siege-cannon',role:'sniper',parts:{weapon:'rail',legs:'tank'}},
 {id:'mobile-sniper',role:'sniper',parts:{weapon:'rail',legs:'ranger'}},
 {id:'flame-rifle',role:'skirmisher',parts:{weapon:'burst',core:'blaze'}},
 {id:'staccato-burst',role:'flanker',parts:{weapon:'burst',core:'rapid'}},
 {id:'needle-swarm',role:'flanker',parts:{weapon:'micro',core:'rapid'}},
 {id:'missile-platform',role:'guardian',parts:{weapon:'missile',legs:'crawler'}},
 {id:'missile-runner',role:'flanker',parts:{weapon:'missile',legs:'booster'}},
 {id:'heavy-breaker',role:'charger',parts:{weapon:'slug',armor:'plated'}},
 {id:'jet-breaker',role:'charger',parts:{weapon:'slug',legs:'jet'}},
 {id:'aegis-bastion',role:'guardian',parts:{armor:'reactive',core:'aegis'}},
 {id:'scout-escape',role:'flanker',parts:{armor:'feather',legs:'ranger'}}
];
let chosenEnemyArchetype=null;
function makeEnemyLoadout(wave){
 const selection=Math.random()<.72?pick(ENEMY_ARCHETYPES):null;
 chosenEnemyArchetype=selection;
 const obj={};
 for(const slot of Object.keys(SLOT)){
  const locked=selection?.parts[slot];
  const def=locked?DEF[slot].find(d=>d.id===locked):pick(DEF[slot]);
  const lv=wave===1?1:Math.max(1,Math.round(1+(wave-1)*.56+rand(-.5,.65)));
  obj[slot]=part(slot,def.id,lv,rarity(wave));
 }
 return obj;
}
/* @include-synergies */
function specs(load,forPlayer=false){
 const a=find(load.armor),l=find(load.legs),c=find(load.core),w=find(load.weapon);
 const af=1+.095*(load.armor.lv-1)+.12*(load.armor.tier-1);
 const lf=1+.053*(load.legs.lv-1)+.055*(load.legs.tier-1);
 const cf=1+.06*(load.core.lv-1)+.08*(load.core.tier-1);
 const wf=1+.095*(load.weapon.lv-1)+.15*(load.weapon.tier-1);
 const synergy=resolveBuildSynergies(load),m=synergy.modifiers;
 const permanent=forPlayer?metaState.upgrades:{hull:0,power:0,drive:0,recovery:0};
 return {
  hp:Math.round(2*(a.hp*af+(l.bonusHp||0)*lf)*m.hp*(1+permanent.hull*.05)),
  guard:clamp(a.guard+.007*(load.armor.lv-1)+.008*(load.armor.tier-1)+(c.guardBonus||0)+m.guard,0,.38),
  speed:l.speed*lf*m.speed*(1+permanent.drive*.03),dashCooldown:Math.max(1.08,l.dash/Math.sqrt(lf)*m.dashCooldown*(1-permanent.drive*.03)),
  dmg:w.damage*wf*c.damage*cf*m.damage*(1+permanent.power*.04),fireCooldown:Math.max(.125,w.cool/(c.rate*cf)*m.fireCooldown),
  weapon:w,armor:a,legs:l,core:c,repair:clamp(c.heal*cf+m.repair+permanent.recovery*.04,0,.65),
  synergies:synergy.active,modifiers:m
 };
}
// Persistent research points survive a wipe; run GOLD and looted parts do not.
const META_KEY='roboSalvageMetaV1';
const META_COSTS=[30,45,70]; // Four three-level lines cost 580 SP.
const META_UPGRADES={
 hull:{name:'強化フレーム',effect:'最大HP +5% / Lv.'},
 power:{name:'高出力回路',effect:'攻撃力 +4% / Lv.'},
 drive:{name:'駆動制御',effect:'移動 +3%、ダッシュ待機 -3% / Lv.'},
 recovery:{name:'自己補修',effect:'戦闘勝利後回復 +4% / Lv.'}
};
function loadMeta(){
 const fallback={points:0,runs:0,earned:0,starter:'pulse',upgrades:{hull:0,power:0,drive:0,recovery:0}};
 try{
  const saved=JSON.parse(localStorage.getItem(META_KEY)||'null');
  if(!saved||typeof saved!=='object')return fallback;
  const safeInt=(v,max)=>Number.isFinite(v)?clamp(Math.floor(v),0,max):0;
  return {
   points:safeInt(saved.points,1000000),runs:safeInt(saved.runs,100000),earned:safeInt(saved.earned,10000000),
   starter:DEF.weapon.some(w=>w.id===saved.starter)?saved.starter:'pulse',
   upgrades:Object.fromEntries(Object.keys(META_UPGRADES).map(k=>[k,safeInt(saved.upgrades?.[k],3)]))
  };
 }catch(_e){return fallback}
}
let metaState=loadMeta(),runSettled=true;
function saveMeta(){try{localStorage.setItem(META_KEY,JSON.stringify(metaState))}catch(_e){}}
function earnedPointsForRun(completed=false){
 // Average five-node run with three victories = 104 SP. Six = 624 SP.
 return 45+depth*7+encountersWon*8+(completed?60:0);
}
function settleRun(completed=false){
 if(runSettled)return 0;
 runSettled=true;
 const award=earnedPointsForRun(completed);
 metaState.points+=award;metaState.earned+=award;metaState.runs++;
 saveMeta();return award;
}
const initial=()=>({
 weapon:part('weapon',metaState.starter),armor:part('armor','mesh'),
 legs:part('legs','wheel'),core:part('core','spark')
});
let state='menu',wave=1,best=Number(localStorage.getItem('roboSalvageBest')||0);
let depth=0,gold=0,routeOptions=[],currentNode='fight',bossCleared=false,runSeed=0,encountersWon=0,shopOffers=[],mapHistory=[];
let routeGraph=[],routeCandidates=[],currentLane=2,chosenNodes=[];
let player=null,enemy=null,bullets=[],effects=[],rings=[],blocks=[],hazards=[],bossAttack=null,bossCooldown=4,bossPattern=0,bossAttackCount=0,aim={x:800,y:295},keys={},fireMouse=false,fireTouch=false,joy={x:0,y:0},wantsDash=false;
let activeJoyPointer=null,soundOn=true,audio=null,clock=0,screenShake=0,enemySeed=0,lootTaken=false,shotsFired=0,menuOpen=false;
$('best').textContent=String(best).padStart(2,'0');
function beep(hz,dur=0.07,vol=.025,type='triangle'){
 if(!soundOn)return;
 try{
  if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;
  o.type=type;o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(Math.max(60,hz*.62),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+dur+.012)
 }catch(e){}
}

/* Original synthesized chiptune: no network, samples, or copyright dependencies. */
const CHIP_SCORES={
 route:[220,0,330,392,294,0,330,262,220,0,294,349,262,0,330,196],
 combat:[330,392,440,0,523,440,392,294,330,392,587,523,440,0,392,294],
 boss:[196,233,262,196,311,262,233,175,196,233,349,311,262,233,175,147],
 result:[392,494,587,784,0,587,784,988],
 dead:[330,294,262,220,196,175,147,0]
};
let musicMode='silent',musicPlaying='silent',musicBus=null,musicBeat=0,musicNext=0,musicSwitchAt=0;
function initMusic(){
 if(!soundOn)return false;
 try{
  if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  if(!musicBus){musicBus=audio.createGain();musicBus.gain.value=0;musicBus.connect(audio.destination)}
  return true;
 }catch(_e){return false}
}
function setMusicMode(mode){
 musicMode=mode;
 if(!initMusic())return;
 musicBus.gain.cancelScheduledValues(audio.currentTime);
 musicBus.gain.setTargetAtTime(0,audio.currentTime,.13);
 musicSwitchAt=audio.currentTime+.30;
}
function chipNote(hz,t,duration,vol,type){
 if(!hz||!audio||!musicBus)return;
 const osc=audio.createOscillator(),amp=audio.createGain();
 osc.type=type;osc.frequency.setValueAtTime(hz,t);
 amp.gain.setValueAtTime(.0001,t);
 amp.gain.linearRampToValueAtTime(vol,t+.008);
 amp.gain.exponentialRampToValueAtTime(.0001,t+duration);
 osc.connect(amp);amp.connect(musicBus);osc.start(t);osc.stop(t+duration+.012);
}
function musicTick(){
 if(!soundOn||!audio||!musicBus)return;
 if(musicMode!==musicPlaying){
  if(audio.currentTime<musicSwitchAt)return;
  musicPlaying=musicMode;musicBeat=0;musicNext=audio.currentTime+.035;
  musicBus.gain.setTargetAtTime(musicPlaying==='silent'?0:1,audio.currentTime,.17);
 }
 const notes=CHIP_SCORES[musicPlaying];if(!notes)return;
 const beat=musicPlaying==='combat'?.165:musicPlaying==='boss'?.19:.24;
 let count=0;
 while(musicNext<audio.currentTime+.095&&count++<3){
  const hz=notes[musicBeat%notes.length];
  chipNote(hz,musicNext,beat*.75,.018,'square');
  if(musicBeat%4===0)chipNote(hz?hz/2:110,musicNext,beat*1.65,.012,'triangle');
  musicBeat++;musicNext+=beat;
 }
}
const PHASE_LETTERS={
 W:['10001','10001','10001','10101','10101','11011','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 N:['10001','11001','10101','10101','10011','10001','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111']
};
function drawPhaseLetters(label){
 const c=$('phaseLetters'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);
 g.imageSmoothingEnabled=false;
 if(PHASE_LETTERS[label[0]]){
  const unit=5,start=Math.round((c.width-(label.length*6-1)*unit)/2);
  for(let k=0;k<label.length;k++)for(let y=0;y<7;y++)for(let x=0;x<5;x++){
   if(PHASE_LETTERS[label[k]][y][x]==='1'){
    g.fillStyle=y===0?'#f2f5d2':label==='LOSE'?'#e88d8f':'#91f3de';
    g.fillRect(start+(k*6+x)*unit,13+y*unit,unit,unit);
   }
  }
 }else{
  const small=document.createElement('canvas');small.width=176;small.height=35;
  const s=small.getContext('2d');
  s.font='bold 24px "MS Gothic","Noto Sans JP",sans-serif';
  s.textAlign='center';s.fillStyle='#91f3de';s.fillText(label,88,27);
  g.drawImage(small,12,4,216,56);
 }
}
function showPhaseCard(label,next,phase){
 state=phase;fireMouse=false;fireTouch=false;keys={};
 showOverlay('<div class="phaseCard"><canvas id="phaseLetters" width="240" height="70" role="img" aria-label="'+label+'"></canvas><button id="phaseContinue" class="primary" type="button">OK</button></div>');
 $('dialog').classList.add('phaseDialog');drawPhaseLetters(label);
 $('phaseContinue').addEventListener('click',next,{once:true});
}

function createRobot(load,x,y,isEnemy=false){
 const s=specs(load,!isEnemy);
 return {x,y,vx:0,vy:0,angle:isEnemy?Math.PI:0,r:22,load,stats:s,hp:s.hp,maxHp:s.hp,
  cd:.25,ammo:s.weapon.mag,reloadLeft:0,reloadTotal:s.weapon.reload,reloadCount:0,shots:0,dashLeft:0,dashCooldown:0,hitFlash:0,dead:false,enemy:isEnemy,aiPhase:rand(0,TAU),aiStrafe:Math.random()<.5?-1:1,
  status:{burn:0,stun:0,slow:0,sunder:0},burnTimer:0,shieldCooldown:0,aiDodgeCooldown:0,aiRetreat:false,aiStuckFor:0,aiReplan:0,aiPath:[],aiEscapeFor:0,aiMode:'seek',
  role:isEnemy?'skirmisher':'player',name:isEnemy?pick(enemyNames):'SALVAGER-01'};
}
function arenaIndex(){return (depth*7+runSeed)%15}
// Each layout changes the topology, not just the position of three crates.
// Rectangles are solid and used by both movement and projectile collision.
function makeCover(){
 const layout=arenaIndex(),out=[];
 const add=(x,y,w,h,material='wall')=>{
  if(x-w/2<248||x+w/2>760||y-h/2<40||y+h/2>550)
   return;
  const durability={rubble:76,pillar:126,wall:190,tower:260,core:340};
  const hp=durability[material]||durability.wall;
  out.push({x,y,w,h,material,idx:out.length,hp,maxHp:hp});
 };
 const row=(xs,y,w,h,kind)=>xs.forEach(x=>add(x,y,w,h,kind));
 const col=(x,ys,w,h,kind)=>ys.forEach(y=>add(x,y,w,h,kind));
 switch(layout){
 case 0: // Twin parallel corridors and a central gate
  add(485,149,345,27);add(515,443,345,27);add(510,297,55,104,'pillar');
  add(341,296,30,82);add(672,296,30,82);break;
 case 1: // Four-room arena with open cross-shaped passages
  row([397,603],180,130,30);row([397,603],415,130,30);
  col(500,[136,457],38,93);add(500,298,62,58,'core');break;
 case 2: // Long zigzag canyon: alternate high and low bulkheads
  add(346,194,38,252);add(472,408,38,252);
  add(597,193,38,252);add(720,406,38,252);
  add(532,89,105,28,'rubble');add(468,500,105,28,'rubble');break;
 case 3: // A central fortress surrounded by six pillars
  add(505,295,182,110,'core');row([347,661],157,52,60,'pillar');
  row([347,661],435,52,60,'pillar');
  row([455,556],92,63,35);row([455,556],501,63,35);break;
 case 4: // Very wide ruined wall, split into three passages
  row([352,505,657],299,88,38,'rubble');
  row([413,592],178,125,36);row([413,592],427,125,36);break;
 case 5: // Ring of ruins: gaps for maneuvering
  add(497,128,210,31);add(497,469,210,31);
  col(383,[220,377],30,88);col(612,[220,377],30,88);
  add(497,298,76,76,'core');break;
 case 6: // Serpentine S-shaped bunker
  add(354,230,36,265);add(461,388,184,31);
  add(580,201,35,255);add(690,390,122,31);
  add(505,101,104,30,'rubble');add(611,490,110,32,'rubble');break;
 case 7: // Narrow horizontal shipping lanes
  row([360,517,674],195,119,32);
  row([360,517,674],398,119,32);
  col(517,[294],37,82,'pillar');break;
 case 8: // Four tall towers / open courtyard
  row([360,638],171,80,138,'tower');
  row([360,638],422,80,138,'tower');
  add(499,298,66,30,'rubble');break; // Leave a traversable side passage around the central barrier.
 case 9: // Double broken moats, asymmetric route
  add(411,185,228,38);add(411,408,228,38);
  add(626,228,37,182);add(626,429,37,125);
  add(507,298,58,55,'pillar');break;
 case 10: // Heavy diagonal stairways
  add(344,172,90,40);add(424,244,90,40);
  add(504,317,90,40);add(584,391,90,40);
  add(667,463,90,40);add(600,145,100,32,'rubble');break;
 case 11: // Layered open strongholds, left and right
  col(385,[157,440],38,94);col(615,[157,440],38,94);
  row([500],158,110,29);row([500],440,110,29);
  add(500,300,68,40,'core');break;
 case 12: // Pillar forest with alternating open passage lanes
  row([332,432,536,636,725],185,37,83,'pillar');
  row([385,488,591,686],395,37,83,'pillar');
  add(515,295,84,30,'rubble');break;
 case 13: // Broad mirrored Z-corridors, large arena-negative spaces
  add(386,216,183,32);add(610,376,183,32);
  add(363,405,35,193);add(636,171,35,193);
  add(504,296,66,61,'core');break;
 case 14: // Final coliseum: semicircular walls around a spacious center
  add(496,110,316,38,'tower');add(496,480,316,38,'tower');
  add(350,197,42,100,'tower');add(350,387,42,100,'tower');
  add(650,197,42,100,'tower');add(650,387,42,100,'tower');
  row([416,584],298,52,39,'pillar');break;
 }
 // A deterministic layout, retaining varied enemies and allowing all stages to be replayed.
 return out;
}

// Hazards are physical arena interactions, not background decoration.
const HAZARD_KINDS=['shock','frost','repair','rotor'];
function makeHazards(){
 const index=arenaIndex();
 const kind=HAZARD_KINDS[index%HAZARD_KINDS.length];
 const positions=[
  {x:368,y:156,r:42},{x:660,y:412,r:42},
  {x:501,y:130,r:36},{x:498,y:468,r:36},
  {x:344,y:352,r:43},{x:669,y:219,r:43}
 ];
 const a=positions[index%3*2],b=positions[index%3*2+1];
 const zones=[{...a,kind,phase:0,cooldown:0}];
 // The second hazard has different rules so positioning matters.
 zones.push({...b,kind:HAZARD_KINDS[(index+1)%HAZARD_KINDS.length],phase:1.2,cooldown:0});
 if(currentNode==='elite'||currentNode==='boss'){
  zones.push({x:500,y:295,r:38,kind:'shock',phase:2.3,cooldown:0});
 }
 return zones;
}
function updateHazards(dt){
 if(state!=='fight')return;
 for(const h of hazards){
  h.phase+=dt;
  const pulse=(Math.sin(h.phase*2.2)+1)/2;
  const active=h.kind==='shock'?pulse>.68:h.kind==='rotor'?pulse>.45:true;
  for(const o of [player,enemy]){
   if(!o||o.dead)continue;
   const d=Math.hypot(o.x-h.x,o.y-h.y);
   if(d>h.r+o.r*.3)continue;
   if(!h.nextHit)h.nextHit={player:0,enemy:0};
   const key=o.enemy?'enemy':'player';
   if(h.kind==='shock'&&active){
    if(clock>=h.nextHit[key]){damage(o,6.5);h.nextHit[key]=clock+.72}
    if(!o.dead)o.status.slow=Math.max(o.status.slow,.12);
   }
   else if(h.kind==='frost'){o.status.slow=Math.max(o.status.slow,.16)}
   else if(h.kind==='rotor'&&active){
    if(clock>=h.nextHit[key]){damage(o,4.5);h.nextHit[key]=clock+.62}
   }
   else if(h.kind==='repair'&&!o.enemy){o.hp=Math.min(o.maxHp,o.hp+4*dt)}
  }
  if(state!=='fight')return;
 }
}
function drawHazards(){
 for(const h of hazards){
  const pulse=(Math.sin(h.phase*2.2)+1)/2;
  const c=h.kind==='shock'?'#ffa85e':h.kind==='frost'?'#76daff':h.kind==='repair'?'#81f4bd':'#fd829f';
  ctx.save();ctx.globalAlpha=.2+pulse*.28;
  ctx.fillStyle=c;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,TAU);ctx.fill();
  ctx.globalAlpha=.55+pulse*.4;ctx.strokeStyle=c;ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(h.x,h.y,h.r-5,0,TAU);ctx.stroke();
  if(h.kind==='rotor'){
   ctx.translate(h.x,h.y);ctx.rotate(h.phase*1.45);
   for(let j=0;j<3;j++){ctx.rotate(TAU/3);ctx.fillRect(0,-4,h.r-8,8)}
  }else if(h.kind==='shock'){
   for(let j=0;j<3;j++){
    let a=j*TAU/3+h.phase*.35;
    ctx.beginPath();ctx.moveTo(h.x+Math.cos(a)*8,h.y+Math.sin(a)*8);
    ctx.lineTo(h.x+Math.cos(a+.25)*(h.r-7),h.y+Math.sin(a+.25)*(h.r-7));ctx.stroke();
   }
  }else if(h.kind==='repair'){
   ctx.fillRect(h.x-3,h.y-14,6,28);ctx.fillRect(h.x-14,h.y-3,28,6);
  }else{for(let j=-1;j<=1;j++)ctx.fillRect(h.x-25,h.y+j*11,50,2)}
  ctx.restore();
 }
}
const NODE={
 fight:{name:'巡回ロボ',symbol:'⚔',desc:'通常戦。撃破でゴールド＋パーツ選択'},
 fight2:{name:'迎撃戦',symbol:'◎',desc:'別の装備の敵と通常戦。戦利品あり'},
 elite:{name:'強敵',symbol:'◆',desc:'装備の強い敵。報酬ゴールドが多い'},
 shop:{name:'ショップ',symbol:'▣',desc:'パーツ購入・強化・修理にゴールドを使う'},
 rest:{name:'休憩',symbol:'✚',desc:'最大HPの45%を回復する'},
 event:{name:'イベント',symbol:'?',desc:'補給・整備・改造から選ぶ'},
 cache:{name:'資材庫',symbol:'▤',desc:'戦わずに追加ゴールドを回収'},
 boss:{name:'最終ボス',symbol:'★',desc:'すべての分岐がここに収束する'}
};
function shuffled(arr){
 const a=arr.slice();
 for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
 return a;
}
function beginRun(){
 wave=1;depth=0;gold=0;encountersWon=0;runSettled=false;runSeed=Math.floor(rand(0,15));
 bossCleared=false;mapHistory=[];currentNode='fight';routeOptions=[];shopOffers=[];
 forcedEventVariant=null;activeEventVariant=null;
 currentLane=2;chosenNodes=[];routeCandidates=[];routeGraph=buildRouteGraph();
 player=createRobot(initial(),166,295);enemy=null;
 bullets=[];effects=[];rings=[];keys={};fireMouse=false;fireTouch=false;
 closeMenu();updatePanels(true);
 showRoute();
}
function buildRouteGraph(){
 const pool=['shop','rest','elite','event','cache','shop','event','elite','rest','shop'];
 return Array.from({length:10},(_,row)=>{
  const left=pick(pool),right=pick(pool.filter(t=>t!==left));
  return Array.from({length:5},(_,lane)=>{
   if(lane===1)return left;
   if(lane===3)return right;
   return lane===2?'fight':row%2===lane%2?'fight':'fight2';
  });
 });
}
function lanesFrom(lane){
 if(lane<=1)return [0,1,2];
 if(lane>=3)return [2,3,4];
 return [lane-1,lane,lane+1];
}
function mapX(lane){return 92+114*lane}
function mapY(row){return 830-row*75}
function mapLine(x1,y1,x2,y2,kind=''){
 return '<path class="map-edge '+kind+'" d="M '+x1+' '+y1+' Q '+((x1+x2)/2)+' '+((y1+y2)/2)+' '+x2+' '+y2+'"/>';
}
function renderRouteMap(){
 let lines='',nodes='';
 // All accessible future branches are visible before the player selects a path.
 for(const lane of lanesFrom(2)) {
  const visited=chosenNodes[0]?.lane===lane;
  const active=depth===0&&routeCandidates.some(n=>n.lane===lane);
  lines+=mapLine(320,906,mapX(lane),mapY(0)+27,visited?'done':active?'active':'');
 }
 for(let row=0;row<9;row++)for(let from=0;from<5;from++){
  for(const to of lanesFrom(from)){
   const selected=chosenNodes[row]?.lane===from&&chosenNodes[row+1]?.lane===to;
   const active=row+1===depth&&chosenNodes[row]?.lane===from&&routeCandidates.some(n=>n.lane===to);
   lines+=mapLine(mapX(from),mapY(row)-25,mapX(to),mapY(row+1)+25,selected?'done':active?'active':'');
  }
 }
 for(let lane=0;lane<5;lane++){
  const last=chosenNodes[9]?.lane===lane;
  lines+=mapLine(mapX(lane),mapY(9)-27,320,81,last?(depth===10?'active':'done'):'');
 }
 for(let row=0;row<10;row++)for(let lane=0;lane<5;lane++){
  const selected=chosenNodes.some(n=>n.depth===row&&n.lane===lane);
  const available=depth===row?routeCandidates.find(n=>n.lane===lane):null;
  const type=available?.type||routeGraph[row][lane],n=NODE[type];
  const special=type!=='fight'&&type!=='fight2';
  const cls='map-node'+(selected?' completed':'')+(available?' current':'')+(special?' special':'');
  const attrs=available?' data-route="'+type+'" data-lane="'+lane+'" role="button" tabindex="0" aria-label="'+n.name+'を選択"':'';
  nodes+='<g class="'+cls+'" transform="translate('+mapX(lane)+' '+mapY(row)+')"'+attrs+'>'
    +'<circle r="28"/><text y="-3">'+n.symbol+'</text><text class="small" y="35">'+n.name+'</text></g>';
 }
 const activeBoss=depth>=10;
 nodes+='<g class="map-node boss'+(activeBoss?' current':'')+'" transform="translate(320 60)"'
  +(activeBoss?' data-route="boss" data-lane="2" tabindex="0" role="button" aria-label="最終ボスに挑戦"':'')
  +'><circle r="35"/><text y="-2">★</text><text class="small" y="45">FINAL BOSS</text></g>';
 nodes+='<circle class="startNode" cx="320" cy="906" r="25"/><text class="map-caption" x="320" y="911" text-anchor="middle">START</text>';
 return '<svg class="mapBoard" viewBox="0 0 640 945" role="img" aria-label="10階層の分岐と最上部のボスマスを示す全体マップ">'
  +'<g>'+lines+'</g><g>'+nodes+'</g></svg>';
}
function showRoute(){
 state='route';setMusicMode('route');updatePanels(true);
 if(depth>=10){
  routeCandidates=[{lane:2,type:'boss'}];routeOptions=['boss'];
 }else{
  routeCandidates=lanesFrom(currentLane).map(lane=>({lane,type:routeGraph[depth][lane]}));
  const combats=routeCandidates.filter(c=>c.type==='fight'||c.type==='fight2');
  combats.forEach((c,i)=>c.type=i===0?'fight':'fight2');
  routeOptions=routeCandidates.map(c=>c.type);
 }
 const final=depth>=10;
 let html='<p class="flag">'+(final?'ALL PATHS CONVERGE':'BRANCHING ROUTE / NODE '+(depth+1)+' OF 10')+'</p>'
  +'<h2>'+(final?'最終ボスへ':'進む道を選ぶ')+'</h2>'
  +'<div class="resourceLine"><span>GOLD '+gold+'</span><span>HP '+Math.ceil(player.hp)+' / '+player.maxHp+'</span></div>'
  +'<div class="mapWrap" id="mapScroll">'+renderRouteMap()+'</div>'
  +'<div class="mapLegend"><span><span class="statusDot"></span><b>光るマス</b>が次の選択肢</span><span>進行 '+depth+' / 10 → ★</span></div>'
  +'<div class="mapHint">'+(final?'10マスを踏破。マップ最上部のボスを選択。':'道は先へ枝分かれし、最後はボスへ集まります。光る3マスから1つタップしてください。')+'</div>';
 showOverlay(html);
 $('dialog').classList.add('routeDialog');
 document.querySelectorAll('#mapScroll [data-route]').forEach(el=>{
  const enter=()=>enterNode(el.dataset.route,Number(el.dataset.lane));
  el.addEventListener('click',enter);
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enter()}});
 });
 const el=$('mapScroll'),y=final?60:mapY(depth);
 const scrollTarget=y*(el.scrollHeight/945)-el.clientHeight*.58;
 el.scrollTop=Math.max(0,scrollTarget);
}
function enterNode(type,lane){
 if(state!=='route')return;
 const choice=routeCandidates.find(c=>c.type===type&&(lane==null||c.lane===lane));
 if(!choice)return;
 currentLane=choice.lane;
 chosenNodes.push({depth,lane:choice.lane,type:choice.type});
 currentNode=type;wave=depth+1;
 if(type==='fight'||type==='fight2'||type==='elite'||type==='boss'){startWave();return}
 if(type==='shop'){openShopNode();return}
 if(type==='rest'){healPlayer(.45);showNodeResult('整備休憩','最大HPの45%を回復した。');return}
 if(type==='cache'){
  const amount=55+depth*13+Math.floor(rand(0,36));gold+=amount;updatePanels(true);
  showNodeResult('資材庫を発見',amount+' Gを獲得した。');return;
 }
 if(type==='event'){openEvent();return}
}
function restoreVitalsFromLoad(){
 if(!player)return;
 const previous=player.maxHp,missing=Math.max(0,previous-player.hp);
 const previousGun=player.stats.weapon.id;
 player.stats=specs(player.load,true);player.maxHp=player.stats.hp;
 if(previousGun!==player.stats.weapon.id){
  player.ammo=player.stats.weapon.mag;player.reloadLeft=0;player.reloadTotal=player.stats.weapon.reload;
 }
 player.hp=clamp(player.maxHp-missing,0,player.maxHp);
 updatePanels(true);
}
function healPlayer(fraction){
 if(!player)return;
 player.hp=Math.min(player.maxHp,player.hp+Math.ceil(player.maxHp*fraction));
 updatePanels(true);
}
function completeNode(){
 mapHistory.push(currentNode);
 depth++;wave=depth+1;
 showRoute();
}
function showNodeResult(title,details){
 state='nodeResult';updatePanels(true);
 showOverlay('<p class="flag">NODE COMPLETE</p><h2>'+title+'</h2><p>'+details+'</p>'
   +'<div class="resourceLine">GOLD '+gold+'　HP '+Math.ceil(player.hp)+' / '+player.maxHp+'</div>'
   +'<button class="primary" id="nodeContinue">進路を選ぶ ▶</button>');
 $('nodeContinue').addEventListener('click',completeNode);
}
function startWave(){
 state='ready';lootTaken=false;bullets=[];effects=[];rings=[];
 blocks=makeCover();hazards=makeHazards();bossAttack=null;bossCooldown=4;bossPattern=0;bossAttackCount=0;
 const load=makeEnemyLoadout(wave);
 enemy=createRobot(load,840,295,true);
 enemy.role=currentNode==='boss'||currentNode==='elite'?chooseEnemyRole(currentNode):chosenEnemyArchetype?.role||chooseEnemyRole(currentNode);
 let warmup=wave===1?.76:wave===2?.87:wave===3?.94:1;
 const kind=currentNode;
 const hpScale=kind==='boss'?2.15:kind==='elite'?1.42:1;
 enemy.maxHp=Math.round(enemy.maxHp*warmup*hpScale);enemy.hp=enemy.maxHp;
 if(kind==='boss'){enemy.stats.dmg*=1.22;enemy.r=30;enemy.name='OMEGA GUARDIAN'}
 else if(kind==='elite'){enemy.stats.dmg*=1.1;enemy.name='ELITE '+pick(enemyNames)}
 else enemy.name=ENEMY_ROLES[enemy.role].label+' '+pick(enemyNames);
 enemySeed=Math.random()*10;
 player.x=165;player.y=295;player.vx=0;player.vy=0;player.cd=0;player.hitFlash=0;
 // Healing happens only after combat, not on entering a new fight.
 player.stats=specs(player.load,true);player.maxHp=player.stats.hp;player.hp=Math.min(player.hp,player.maxHp);
 player.dashCooldown=0;player.dashLeft=0;player.status={burn:0,stun:0,slow:0,sunder:0};player.shieldCooldown=0;
 player.ammo=player.stats.weapon.mag;player.reloadLeft=0;player.reloadTotal=player.stats.weapon.reload;
 updatePanels(true);setMusicMode('silent');
 showPhaseCard('戦闘準備',()=>{state='fight';closeOverlay();setMusicMode(currentNode==='boss'?'boss':'combat');beep(520,.12,.04)},'ready');
}
// Three node families provide different survival, salvage, and resource trade-offs.
const EVENT_VARIANTS=[
 {id:'depot',title:'放棄された補給庫',description:'残された資材を1つ回収する。',choices:['supply','heal','upgrade']},
 {id:'forge',title:'無人の鍛造工場',description:'未知の武装に換装するか、堅実に整備するか。',choices:['reforge','heal','upgrade']},
 {id:'vault',title:'汚染された金庫',description:'機体の耐久力を代償に大量の資金を得られる。',choices:['supply','overload','upgrade']}
];
let forcedEventVariant=null,activeEventVariant=null;
function eventOptions(boostSlot){
 const healthCost=Math.ceil(player.maxHp*.18);
 return {
  supply:{symbol:'▤',title:'補給物資',detail:'ゴールド +'+(65+depth*14)},
  heal:{symbol:'✚',title:'応急整備',detail:'最大HPの22%を回復'},
  upgrade:{symbol:'✧',title:'未知の設計図',detail:SLOT[boostSlot]+' Lv.+1'},
  reforge:{symbol:'⚒',title:'武装の再構築',detail:'武器を別の種類に換装 / Lv.+1（ランダム）'},
  overload:{symbol:'⚡',title:'危険な金庫開封',detail:'HP -'+healthCost+' / +'+(150+depth*20)+' G',
   disabled:player.hp<=healthCost+1}
 };
}
function openEvent(){
 state='event';
 const variant=EVENT_VARIANTS.find(v=>v.id===forcedEventVariant)
   ||EVENT_VARIANTS[(depth+runSeed)%EVENT_VARIANTS.length];
 forcedEventVariant=null;activeEventVariant=variant.id;
 const boostSlot=Object.keys(SLOT).reduce((a,b)=>player.load[a].lv<=player.load[b].lv?a:b);
 const options=eventOptions(boostSlot);
 let html='<p class="flag">UNKNOWN SIGNAL / '+variant.id.toUpperCase()+'</p><h2>'+variant.title+'</h2>'
  +'<p>'+variant.description+' 次の3つから1つだけ選択。</p><div class="routeChoices">';
 for(const id of variant.choices){
  const item=options[id];
  html+='<button class="routeChoice'+(id==='heal'?' rest':'')+'" data-event="'+id+'"'
   +(item.disabled?' disabled aria-disabled="true"':'')+'>'
   +'<span class="symbol">'+item.symbol+'</span><strong>'+item.title+'</strong>'
   +'<small>'+item.detail+(item.disabled?'（HP不足）':'')+'</small></button>';
 }
 html+='</div>';
 showOverlay(html);
 document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>{
  if(state!=='event'||b.disabled)return;
  const choice=b.dataset.event;
  let detail='';
  if(choice==='supply'){
   const reward=65+depth*14;gold+=reward;detail=reward+' G獲得';
  }else if(choice==='heal'){
   healPlayer(.22);detail='最大HPの22%を回復';
  }else if(choice==='upgrade'){
   player.load[boostSlot].lv++;restoreVitalsFromLoad();
   detail=SLOT[boostSlot]+'をLv.'+player.load[boostSlot].lv+'に改造';
  }else if(choice==='reforge'){
   const previous=player.load.weapon;
   const candidates=DEF.weapon.filter(w=>w.id!==previous.id);
   const next=pick(candidates);
   player.load.weapon=part('weapon',next.id,previous.lv+1,previous.tier);
   restoreVitalsFromLoad();
   detail='武器を'+next.name+' Lv.'+player.load.weapon.lv+'へ換装';
  }else if(choice==='overload'){
   const cost=Math.ceil(player.maxHp*.18);
   if(player.hp<=cost+1)return;
   const reward=150+depth*20;
   player.hp-=cost;gold+=reward;updatePanels(true);
   detail='HP '+cost+'を消費して'+reward+' G獲得';
  }else return;
  showNodeResult('イベント完了',detail);
 }));
}
function shopCost(kind,slot){
 if(kind==='repair')return 55+depth*8;
 if(kind==='upgrade')return 68+player.load[slot].lv*28+depth*7;
 return 100+depth*16;
}
function openShopNode(){
 state='shop';
 shopOffers=shuffled(Object.keys(SLOT)).slice(0,2).map(slot=>{
  const def=pick(DEF[slot]);
  return {slot,part:part(slot,def.id,Math.max(player.load[slot].lv+1,1+Math.round(depth*.57)),rarity(depth+2)),
          price:shopCost('offer',slot)+Math.round(rand(4,31))};
 });
 renderShop();
}
function buyShop(kind,arg){
 if(state!=='shop')return;
 let cost=0;
 if(kind==='repair'){
  cost=shopCost('repair');if(player.hp>=player.maxHp||gold<cost)return;
  gold-=cost;healPlayer(.35);
 }else if(kind==='upgrade'&&SLOT[arg]){
  cost=shopCost('upgrade',arg);if(gold<cost)return;
  gold-=cost;player.load[arg].lv++;restoreVitalsFromLoad();
 }else if(kind==='offer'){
  const item=shopOffers[Number(arg)];if(!item||item.bought||gold<item.price)return;
  gold-=item.price;player.load[item.slot]=clone(item.part);item.bought=true;restoreVitalsFromLoad();
 }else return;
 updatePanels(true);beep(730,.11,.035);renderShop();
}
function renderShop(){
 if(state!=='shop')return;
 let html='<p class="flag">SERVICE BAY / SHOP</p><h2>ショップ</h2>'
 +'<div class="resourceLine"><span>GOLD '+gold+'</span><span>HP '+Math.ceil(player.hp)+' / '+player.maxHp+'</span></div>'
 +'<div class="shopGrid">';
 const repair=shopCost('repair');
 html+='<button class="shopItem" data-shop="repair" '+(gold<repair||player.hp>=player.maxHp?'disabled':'')
  +'><strong>✚ 機体を修理</strong><small>最大HPの35%を回復</small><span class="cost">'+repair+' G</span></button>';
 for(const slot of Object.keys(SLOT)){
  const cost=shopCost('upgrade',slot);
  html+='<button class="shopItem" data-shop="upgrade" data-arg="'+slot+'" '+(gold<cost?'disabled':'')
   +'><strong>↑ '+SLOT[slot]+'</strong><small>'+find(player.load[slot]).name+' Lv.'+player.load[slot].lv+' → '+(player.load[slot].lv+1)+'</small>'
   +'<span class="cost">'+cost+' G</span></button>';
 }
 for(let i=0;i<shopOffers.length;i++){
  const item=shopOffers[i],p=item.part;
  html+='<button class="shopItem" data-shop="offer" data-arg="'+i+'" '+(item.bought||gold<item.price?'disabled':'')
   +'><strong>⇄ '+find(p).name+'</strong><small>'+SLOT[item.slot]+' / Lv.'+p.lv+' ★'+p.tier+'　装備と交換</small>'
   +'<span class="cost">'+(item.bought?'購入済':item.price+' G')+'</span>'
   +buildComparisonMarkup(player.load,{...player.load,[item.slot]:p})+'</button>';
 }
 html+='</div><button class="primary" id="leaveShop">ショップを出る ▶</button>';
 showOverlay(html);
 document.querySelectorAll('[data-shop]').forEach(b=>b.addEventListener('click',()=>buyShop(b.dataset.shop,b.dataset.arg)));
 $('leaveShop').addEventListener('click',completeNode);
}

function updatePanels(forceParts){
 $('topWave').textContent=String(wave).padStart(2,'0');
 $('goldText').textContent=gold+' G';$('depthText').textContent=depth+' / 10';
 if($('metaPoints'))$('metaPoints').textContent=metaState.points+' SP';
 $('playerModel').textContent='SALVAGER-01';
 $('enemyModel').textContent=enemy?enemy.name:'SCANNING';
 if(player){
  $('playerHpBar').style.width=(100*clamp(player.hp/player.maxHp,0,1))+'%';
  $('playerHpText').textContent=Math.ceil(Math.max(0,player.hp))+' / '+player.maxHp+' HP';
  $('playerPower').textContent='DASH '+Math.max(0,player.dashCooldown).toFixed(1)+'s';
 const reloading=player.reloadLeft>0,capacity=player.stats.weapon.mag;
 $('ammoHud').classList.toggle('active',state==='fight');
 $('ammoCount').textContent=player.ammo+' / '+capacity;
 $('ammoLabel').textContent=reloading?'RELOADING '+player.reloadLeft.toFixed(1)+'s':player.stats.weapon.name;
 $('ammoBar').style.width=(100*(reloading?1-player.reloadLeft/player.reloadTotal:player.ammo/capacity))+'%';
 $('ammoBar').classList.toggle('reloading',reloading);
 $('reloadDesk').disabled=state!=='fight'||reloading||player.ammo>=capacity;
 $('reloadTouch').disabled=state!=='fight'||reloading||player.ammo>=capacity;
 $('reloadTouch').textContent=reloading?player.reloadLeft.toFixed(1)+'s':'RELOAD';
 }
 if(enemy){
  $('enemyHpBar').style.width=(100*clamp(enemy.hp/enemy.maxHp,0,1))+'%';
  $('enemyHpText').textContent=Math.ceil(Math.max(0,enemy.hp))+' / '+enemy.maxHp+' HP';
  $('enemyPower').textContent='THREAT '+wave;
 }
 if(forceParts){
  if(player)partsPanel('playerParts',player.load);
  if(enemy)partsPanel('enemyParts',enemy.load);
 }
}
function partsPanel(id,load){
 const root=$(id);root.textContent='';
 for(const slot of Object.keys(SLOT)){
  const p=load[slot],def=find(p),el=document.createElement('div');el.className='partRow';
  const left=document.createElement('div');left.className='left';
  const sub=document.createElement('div');sub.className='slot';sub.textContent=SLOT[slot];
  const nm=document.createElement('div');nm.className='name';nm.textContent=def.name;
  left.append(sub,nm);
  const lv=document.createElement('div');lv.className='lvl';lv.textContent='Lv.'+p.lv+' ★'+p.tier;
  lv.style.color=RARCOL[p.tier];el.append(left,lv);root.append(el);
 }
 const active=findBuildSynergies(load);
 const section=document.createElement('div');section.className='synergySummary';
 const label=document.createElement('div');label.className='synergyLabel';
 label.textContent='4部位コンボ '+active.length+' 件';section.append(label);
 if(active.length){
  for(const combo of active){
   const item=document.createElement('div');item.className='synergyEntry';
   const name=document.createElement('strong');name.textContent=combo.name;
   const detail=document.createElement('small');detail.textContent=combo.description;
   item.append(name,detail);section.append(item);
  }
 }else{
  const none=document.createElement('small');
  none.textContent='装備の組み合わせで固有の相乗効果が発動';
  section.append(none);
 }
 root.append(section);
}
function showOverlay(html){$('dialog').className='dialog';$('dialog').innerHTML=html;$('overlay').classList.add('show');document.querySelector('.shell').classList.add('overlayOpen')}
function closeOverlay(){$('overlay').classList.remove('show');document.querySelector('.shell').classList.remove('overlayOpen')}

function renderHangar(){
 state='menu';fireMouse=false;fireTouch=false;keys={};wantsDash=false;closeMenu();
 player=createRobot(initial(),240,295,false);enemy=createRobot(makeEnemyLoadout(1),760,295,true);
 updatePanels(true);
 const levels=Object.values(metaState.upgrades).reduce((a,b)=>a+b,0);
 let html='<p class="flag">HANGAR / 永続強化</p><h2>機体整備・初期装備</h2>'
  +'<div class="metaSummary"><span>研究ポイント <b id="metaBalance">'+metaState.points+' SP</b></span>'
  +'<span>強化 '+levels+' / 12</span><span>周回 '+metaState.runs+'</span></div>'
  +'<div class="metaHint">装備とGOLDは敗北で失うが、SPと永久強化は引き継ぐ。中盤まで約6周で全強化できる設計（必要合計580 SP）。</div>'
  +'<h3 class="hangarTitle">STARTER WEAPON / 初期武器</h3><div class="starterGrid">';
 for(const w of DEF.weapon){
  const selected=metaState.starter===w.id;
  html+='<button type="button" class="starterOption'+(selected?' selected':'')+'" data-starter="'+w.id+'" aria-pressed="'+selected+'">'
   +'<span class="starterGlyph" style="color:'+w.color+'">'+({pulse:'⌁',shot:'▥',rail:'═',missile:'▣',micro:'⋮',burst:'≡',slug:'▰'}[w.id])+'</span>'
   +'<strong>'+w.name+'</strong><small>'+w.detail+'</small></button>';
 }
 html+='</div><h3 class="hangarTitle">PERMANENT RESEARCH / 永続強化</h3><div class="metaUpgradeGrid">';
 for(const [id,item] of Object.entries(META_UPGRADES)){
  const level=metaState.upgrades[id],price=level>=3?0:META_COSTS[level];
  html+='<button type="button" class="metaUpgrade" data-meta="'+id+'" '+(level===3||metaState.points<price?'disabled':'')+'>'
   +'<span><strong>'+item.name+'</strong><small>'+item.effect+'</small></span>'
   +'<span class="metaPrice">'+(level>=3?'MAX':'Lv.'+level+'/3 · '+price+' SP')+'</span></button>';
 }
 html+='</div><button type="button" class="primary hangarStart" id="startBtn">この装備で出撃 ▶</button>';
 showOverlay(html);$('dialog').classList.add('hangarDialog');
 document.querySelectorAll('[data-starter]').forEach(b=>b.addEventListener('click',()=>{
  if(state!=='menu')return;metaState.starter=b.dataset.starter;saveMeta();renderHangar();
 }));
 document.querySelectorAll('[data-meta]').forEach(b=>b.addEventListener('click',()=>{
  if(state!=='menu'||b.disabled)return;
  const id=b.dataset.meta,lv=metaState.upgrades[id],price=META_COSTS[lv];
  if(lv>=3||metaState.points<price)return;
  metaState.points-=price;metaState.upgrades[id]++;saveMeta();renderHangar();beep(620,.10,.023);
 }));
 $('startBtn').addEventListener('click',beginRun);
}

function win(){
 if(state!=='fight')return;
 fireMouse=false;fireTouch=false;keys={};encountersWon++;
 const reward=currentNode==='boss'?240+depth*25:currentNode==='elite'?112+depth*22:55+depth*13;
 gold+=reward;healPlayer(.30+player.stats.repair);
 best=Math.max(best,depth+1);localStorage.setItem('roboSalvageBest',String(best));$('best').textContent=String(best).padStart(2,'0');
 if(currentNode==='boss'){
  bossCleared=true;state='victory';mapHistory.push('boss');
  const earned=settleRun(true);
  showPhaseCard('WIN',()=>{state='victory';setMusicMode('result');showOverlay('<p class="flag">ROUTE CLEAR / BOSS DEFEATED</p><h2>全エリア踏破！</h2>'
   +'<p>10マスの分岐を生き抜き、最終ボスを撃破しました。</p>'
   +'<div class="statline"><div class="statpill">通過 '+depth+' マス</div>'
   +'<div class="statpill">撃破 '+encountersWon+' 機</div>'
   +'<div class="statpill">GOLD '+gold+'</div></div>'
   +'<p class="metaReward">研究ポイント +'+earned+' SP ／ 所持 '+metaState.points+' SP（永久保存）</p>'
   +'<button id="newRun" class="primary">格納庫で強化・次の周回へ ▶</button>');
  $('newRun').addEventListener('click',renderHangar);beep(860,.27,.05)},'winCard');return;
 }
 lootTaken=false;
 const bonus=40+depth*9;
 let text='<p class="flag">TARGET DESTROYED / SALVAGE COMPLETE</p><h2>撃破成功！</h2>';
 text+='<div class="resourceLine"><span>獲得 +'+reward+' G</span><span>戦闘後 HP +30%</span><span>所持 '+gold+' G</span></div>';
 text+='<p>敵機 <strong>'+enemy.name+'</strong> のパーツを1個奪うか、交換を見送って追加ゴールドを得るか選択。</p>';
 text+='<div class="lootGrid">';
 const descriptions={
 weapon:p=>'攻撃 '+Math.round(specs({...player.load,weapon:p},true).dmg)+' / '+find(p).detail,
 armor:p=>'最大HP '+specs({...player.load,armor:p},true).hp+' / '+find(p).detail,
 legs:p=>'速度 '+Math.round(specs({...player.load,legs:p},true).speed)+' / '+find(p).detail,
 core:p=>find(p).detail
 };
 for(const slot of Object.keys(SLOT)){
  const p=enemy.load[slot],own=player.load[slot],desc=find(p);
  text+='<button type="button" class="lootCard" data-loot="'+slot+'"><span class="slot">'+SLOT[slot]+'</span>'
   +'<span class="rarity" style="color:'+RARCOL[p.tier]+';border-color:'+RARCOL[p.tier]+'66">'+RAR[p.tier]+'</span>'
   +'<div class="partname">'+desc.name+'</div><div class="detail">Lv.'+p.lv+' ★'+p.tier+'　'+descriptions[slot](p)+'</div>'
   +'<div class="repl">現在：'+find(own).name+' Lv.'+own.lv+' → 交換</div>'
   +buildComparisonMarkup(player.load,{...player.load,[slot]:p})+'</button>';
 }
 text+='</div><button id="skipLoot" class="secondary" style="margin-top:13px;width:100%">奪わずに解体する（+'+bonus+' G）</button>';
 text+='<div class="lootHelp">※ 部品は最大1個。スキップでも次の分岐へ進みます。</div>';
 showPhaseCard('WIN',()=>{
  state='loot';setMusicMode('result');showOverlay(text);updatePanels(true);
  document.querySelectorAll('[data-loot]').forEach(b=>b.addEventListener('click',()=>chooseLoot(b.getAttribute('data-loot'))));
  $('skipLoot').addEventListener('click',skipLoot);
  beep(820,.23,.055,'sine');setTimeout(()=>beep(990,.2,.038),90);
 },'winCard');
}
function chooseLoot(slot){
 if(state!=='loot'||lootTaken||!SLOT[slot])return;
 lootTaken=true;player.load[slot]=clone(enemy.load[slot]);
 restoreVitalsFromLoad();completeNode();
}
function skipLoot(){
 if(state!=='loot'||lootTaken)return;
 lootTaken=true;gold+=40+depth*9;completeNode();
}

function lost(){
 if(state!=='fight')return;
 const lostGold=gold,earned=settleRun(false);
 // Run loot and GOLD are lost; research SP survives.
 gold=0;player.load=initial();player.stats=specs(player.load,true);
 fireMouse=false;fireTouch=false;
 best=Math.max(best,depth);localStorage.setItem('roboSalvageBest',String(best));$('best').textContent=String(best).padStart(2,'0');
 showPhaseCard('LOSE',()=>{
  state='dead';setMusicMode('dead');
  showOverlay('<p class="flag">SIGNAL LOST / RUN ENDED</p><h2>機体、戦闘不能。</h2>'
   +'<p>到達地点 <strong>'+(depth+1)+'</strong> ／ 今回撃破 <strong>'+encountersWon+'</strong>機。装備と所持金 '+lostGold+' Gはすべて失いました。</p>'
   +'<p class="metaReward">研究ポイント +'+earned+' SP ／ 所持 '+metaState.points+' SP（永久保存）</p>'
   +'<div class="statline"><div class="statpill">撃破 '+encountersWon+'</div><div class="statpill">BEST '+best+'</div></div>'
   +'<button class="primary" id="againBtn">格納庫で強化・再出撃 ▶</button>'
   +'<div class="mini">SPで永久強化が可能。次の周回では初期武器も変更できます。</div>');
  updatePanels(true);$('againBtn').addEventListener('click',renderHangar);
  beep(140,.36,.055,'sawtooth');
 },'loseCard');
}
function setInputVector(){
 let x=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;
 let y=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+joy.y;
 let d=Math.hypot(x,y);
 return d>1?{x:x/d,y:y/d}:{x,y};
}
function hitRect(x,y,r,b){
 const cx=clamp(x,b.x-b.w/2,b.x+b.w/2),cy=clamp(y,b.y-b.h/2,b.y+b.h/2);
 return (x-cx)*(x-cx)+(y-cy)*(y-cy)<r*r;
}
// Finite cover durability creates tactical passages during longer firefights.
function damageCover(b,damage,x=b.x,y=b.y){
 if(!b||!blocks.includes(b))return false;
 b.hp=Math.max(0,b.hp-Math.max(0,damage));
 if(b.hp>0){
  if(Math.random()<.25)particle(x,y,'#9bb9c0',2,.25);
  return false;
 }
 const i=blocks.indexOf(b);
 if(i>=0)blocks.splice(i,1);
 particle(b.x,b.y,b.material==='rubble'?'#e6a7a0':'#a0c8d4',18,.7);
 ring(b.x,b.y,'#e9c889',Math.max(15,Math.min(b.w,b.h)*.55));
 screenShake=Math.min(8,screenShake+2);
 return true;
}
function moveRobot(o,dx,dy){
 let nx=clamp(o.x+dx,38,W-38),ny=clamp(o.y+dy,39,H-39);
 if(!arenaAllowed(nx,o.y,o.r))nx=o.x;
 if(!arenaAllowed(nx,ny,o.r))ny=o.y;
 for(const b of blocks){if(hitRect(nx,o.y,o.r,b))nx=o.x;if(hitRect(nx,ny,o.r,b))ny=o.y}
 o.x=nx;o.y=ny;
}
function particle(x,y,color,n=9,scale=1){
 for(let i=0;i<n;i++){
  const a=rand(0,TAU),v=rand(65,230)*scale,life=rand(.22,.68);
  effects.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,color,size:rand(2,6)});
 }
}
function ring(x,y,color,r=20){rings.push({x,y,color,r,life:.30,max:.30})}
function damage(target,amount){
 if(target.dead||state!=='fight')return;
 if(target===player)amount*=.86; // Enemy deals 14% less damage; loot strength unchanged.
 if(target===player&&target.dashLeft>0)return;
 const armor=target.stats.armor;
 let protection=target.stats.guard-(target.status?.sunder>0?.085:0);
 if(armor.id==='reactive'&&target.shieldCooldown<=0){
  amount*=.58*target.stats.modifiers.reactive;target.shieldCooldown=6.8;ring(target.x,target.y,'#a6d7ff',30);
 }
 const loss=amount*(1-clamp(protection,0,.38));
 target.hp=Math.max(0,target.hp-loss);target.hitFlash=.15;screenShake=Math.min(8,screenShake+2.1);
 particle(target.x,target.y,target.enemy?'#ff7e86':'#66edee',7,.7);
 if(target.hp<=0){
  target.dead=true;particle(target.x,target.y,target.enemy?'#ffb06c':'#8aeafa',48,1.5);
  ring(target.x,target.y,target.enemy?'#ffb578':'#62f0ef',42);
  if(target.enemy)win();else lost();
 }else beep(target.enemy?240:160,.04,.008);
}
// Weapon traits are explicit combat rules, applied equally to the enemy and player.
function applyWeaponImpact(b,target){
 if(state!=='fight'||target.dead)return;
 const traits=WEAPON_TRAITS[b.kind]||{};
 const modifiers=b.source?.stats?.modifiers||SYNERGY_DEFAULT;
 for(const key of ['burn','slow','stun','sunder'])
  if(traits[key])target.status[key]=Math.max(target.status[key],traits[key]*modifiers[key]);
 if(traits.push){
  const dx=target.x-b.source.x,dy=target.y-b.source.y,d=Math.max(1,Math.hypot(dx,dy));
  moveRobot(target,dx/d*traits.push*modifiers.push,dy/d*traits.push*modifiers.push);
  ring(target.x,target.y,'#ffd3a5',24);
 }
 if(traits.splash){
  ring(target.x,target.y,b.color,traits.splash*modifiers.splash*.6);
  particle(target.x,target.y,b.color,14,.65);
 }
}
function updateStatus(robot,dt){
 if(!robot||robot.dead)return;
 robot.shieldCooldown=Math.max(0,robot.shieldCooldown-dt);
 for(const key of ['stun','slow','sunder','burn'])
  robot.status[key]=Math.max(0,robot.status[key]-dt);
 // Damage-over-time has a tick interval to avoid spawning hit particles every frame.
 if(robot.status.burn>0&&state==='fight'){
  robot.burnTimer-=dt;
  if(robot.burnTimer<=0){robot.burnTimer=.35;damage(robot,1.12)}
 }else robot.burnTimer=0;
}
function blastMissileOnWall(b){
 const r=WEAPON_TRAITS.missile.splash*b.source.stats.modifiers.splash,target=b.source.enemy?player:enemy;
 particle(b.x,b.y,b.color,15,.75);ring(b.x,b.y,b.color,r*.6);
 if(target&&!target.dead&&Math.hypot(target.x-b.x,target.y-b.y)<r)
  damage(target,b.damage*.6);
}
function lineOfSight(a,b){
 for(const rect of blocks){
  for(let t=.15;t<1;t+=.12){let x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;if(hitRect(x,y,2,rect))return false}
 }
 return true;
}

/* A magazine contains trigger pulls, not pellets: a spread-shot costs one round.
   Manual reload works with a partially full magazine; empty auto-reloads.
   Both player and hostile robots use the same ammo rules. */
function startReload(o){
 if(!o||o.dead||state!=='fight'||o.reloadLeft>0||o.ammo>=o.stats.weapon.mag)return false;
 o.reloadTotal=o.stats.weapon.reload;
 o.reloadLeft=o.reloadTotal;
 o.reloadCount++;
 if(o===player)beep(290,.08,.016,'square');
 return true;
}
function updateReload(o,dt){
 if(!o||o.dead||o.reloadLeft<=0)return;
 o.reloadLeft=Math.max(0,o.reloadLeft-dt);
 if(o.reloadLeft===0){
  o.ammo=o.stats.weapon.mag;
  if(o===player)beep(780,.09,.018,'triangle');
 }
}
function shoot(o,target,angleOverride){
 if(o.cd>0||o.dead||state!=='fight'||o.reloadLeft>0)return;
 if(o.ammo<=0){startReload(o);return;}
 let s=o.stats,w=s.weapon,dx=target.x-o.x,dy=target.y-o.y;
 let baseAngle=typeof angleOverride==='number'?angleOverride:Math.atan2(dy,dx);
 o.angle=baseAngle;
 let scale=1;let bulletDamage=s.dmg;
 for(let i=0;i<w.count;i++){
  let angle=baseAngle+(i-(w.count-1)/2)*w.spread+(Math.random()-.5)*.045;
  let v=w.velocity*scale;
  bullets.push({x:o.x+Math.cos(angle)*25,y:o.y+Math.sin(angle)*25,px:o.x,py:o.y,
   vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,spd:v,
   r:w.id==='missile'?8:w.id==='rail'?5:6,life:w.id==='rail'?.8:2.1,
   damage:bulletDamage,source:o,kind:w.id,color:w.color,pierce:w.pierce,
   trail:[],homing:w.homing});
 }
 o.ammo--;o.shots++;o.cd=s.fireCooldown*(o.enemy?1.12:1);shotsFired++;
 if(o.ammo<=0)startReload(o);
 ring(o.x+Math.cos(baseAngle)*26,o.y+Math.sin(baseAngle)*26,w.color,11);
 beep(w.id==='rail'?670:w.id==='shot'?240:w.id==='missile'?330:450,.045,.012,w.id==='missile'?'sawtooth':'triangle');
}
// Role-specific projectile dodging: only enemies with evasive tactics use it.
function enemyDodgeStep(dt){
 if(!enemy||enemy.dead||enemy.status.stun>0)return false;
 if(!['flanker','sniper','guardian','boss'].includes(enemy.role))return false;
 enemy.aiDodgeCooldown=Math.max(0,enemy.aiDodgeCooldown-dt);
 if(enemy.aiDodgeCooldown>0)return false;
 for(const b of bullets){
  if(b.source!==player)continue;
  const dx=enemy.x-b.x,dy=enemy.y-b.y;
  const dist=Math.hypot(dx,dy);
  if(dist>172||dist<24)continue;
  const heading=(dx*b.vx+dy*b.vy)/(Math.max(1,dist)*Math.max(1,b.spd));
  if(heading<.65)continue;
  const ox=enemy.x,oy=enemy.y,sign=enemy.aiStrafe;
  moveRobot(enemy,-b.vy/Math.max(1,b.spd)*sign*enemy.stats.speed*dt*.9,
                  b.vx/Math.max(1,b.spd)*sign*enemy.stats.speed*dt*.9);
  enemy.aiDodgeCooldown=.32;
  if(Math.hypot(enemy.x-ox,enemy.y-oy)>1)particle(enemy.x,enemy.y,'#aaddff',2,.25);
  return true;
 }
 return false;
}
function addBossShot(angle,speed=350,damage=11,homing=false){
 const x=enemy.x+Math.cos(angle)*(enemy.r+10),y=enemy.y+Math.sin(angle)*(enemy.r+10);
 bullets.push({x,y,px:x,py:y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,spd:speed,
  r:homing?8:6,life:homing?2.1:2.7,damage,source:enemy,kind:'boss',color:homing?'#e4b5ff':'#ffc67e',
  pierce:false,trail:[],homing});
}
function executeBossAttack(){
 if(!bossAttack||!enemy||enemy.dead||state!=='fight')return;
 const {kind,angle}=bossAttack;
 if(kind==='ring'){
  for(let i=0;i<14;i++)addBossShot(i*TAU/14+angle*.10,285,9);
  ring(enemy.x,enemy.y,'#ffd98f',42);
 }else if(kind==='fan'){
  for(let i=-3;i<=3;i++)addBossShot(angle+i*.19,425,12);
  ring(enemy.x,enemy.y,'#ffb192',32);
 }else if(kind==='beam'){
  const dx=player.x-enemy.x,dy=player.y-enemy.y;
  const length=Math.hypot(dx,dy),ahead=dx*Math.cos(angle)+dy*Math.sin(angle);
  const perpendicular=Math.abs(dx*Math.sin(angle)-dy*Math.cos(angle));
  if(ahead>=0&&ahead<1050&&perpendicular<player.r+19&&length>0)damage(player,23);
  ring(enemy.x,enemy.y,'#ff7399',32);
  for(let i=0;i<13;i++)particle(enemy.x+Math.cos(angle)*i*55,
    enemy.y+Math.sin(angle)*i*55,'#ff8cae',2,.25);
 }else if(kind==='salvo'){
  for(let i=-2;i<=2;i++)addBossShot(angle+i*.31,310,10,true);
  ring(enemy.x,enemy.y,'#c5b2ff',38);
 }
 bossAttackCount++;
 beep(kind==='beam'?180:470,.16,.04,kind==='beam'?'sawtooth':'triangle');
}
function updateBossPatterns(dt){
 if(currentNode!=='boss'||!enemy||enemy.dead||state!=='fight')return;
 const phaseTwo=enemy.hp/enemy.maxHp<.5;
 if(bossAttack){
  bossAttack.windup-=dt;
  if(bossAttack.windup<=0){
   executeBossAttack();bossAttack=null;bossCooldown=phaseTwo?2.7:4.0;
  }
 }else{
  bossCooldown-=dt;
  if(bossCooldown<=0){
   const kinds=['fan','ring','beam','salvo'];
   const kind=kinds[bossPattern++%kinds.length];
   bossAttack={kind,windup:phaseTwo?.68:.96,
     angle:Math.atan2(player.y-enemy.y,player.x-enemy.x)};
  }
 }
}
function drawBossTelegraph(){
 if(!bossAttack||currentNode!=='boss'||!enemy||enemy.dead||state!=='fight')return;
 const a=bossAttack.angle,w=clamp(1-bossAttack.windup/1.05,0,1);
 ctx.save();ctx.globalAlpha=.28+w*.45;ctx.strokeStyle='#ff8b9c';
 ctx.lineWidth=3+w*5;
 ctx.beginPath();ctx.arc(enemy.x,enemy.y,44+w*11,0,TAU);ctx.stroke();
 if(bossAttack.kind==='beam'){
  ctx.beginPath();ctx.moveTo(enemy.x,enemy.y);
  ctx.lineTo(enemy.x+Math.cos(a)*1050,enemy.y+Math.sin(a)*1050);ctx.stroke();
 }else if(bossAttack.kind==='fan'||bossAttack.kind==='salvo'){
  const spread=bossAttack.kind==='fan'?.57:.65;
  for(const offset of [-spread,0,spread]){
   ctx.beginPath();ctx.moveTo(enemy.x,enemy.y);
   ctx.lineTo(enemy.x+Math.cos(a+offset)*310,enemy.y+Math.sin(a+offset)*310);ctx.stroke();
  }
 }else{
  ctx.beginPath();ctx.arc(enemy.x,enemy.y,160,0,TAU);ctx.stroke();
 }
 ctx.restore();
}

/* Stable navigation against solid cover, using the existing collision map. */
function findEnemyPath(sx,sy,tx,ty){
 const gap=32,nx=30,ny=17,cells=[],parents=new Int16Array(nx*ny);
 parents.fill(-2);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const px=35+x*gap,py=39+y*gap;
  cells.push({x:px,y:py,ok:arenaAllowed(px,py,enemy.r)&&!blocks.some(b=>hitRect(px,py,enemy.r,b))});
 }
 const closest=(x,y)=>{
  let idx=-1,dmin=Infinity;
  for(let i=0;i<cells.length;i++)if(cells[i].ok){
   const d=(cells[i].x-x)**2+(cells[i].y-y)**2;
   if(d<dmin){dmin=d;idx=i}
  }return idx;
 };
 const start=closest(sx,sy),end=closest(tx,ty);
 if(start<0||end<0||start===end)return [];
 const q=[start];parents[start]=-1;let front=0;
 while(front<q.length){
  const n=q[front++];if(n===end)break;
  const x=n%nx,y=Math.floor(n/nx);
  for(const [xx,yy] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
   if(xx<0||xx>=nx||yy<0||yy>=ny)continue;
   const k=yy*nx+xx;
   if(!cells[k].ok||parents[k]!==-2)continue;
   parents[k]=n;q.push(k);
  }
 }
 if(parents[end]===-2)return [];
 const path=[];
 for(let k=end;k!==start&&k!==-1;k=parents[k])path.push(cells[k]);
 return path.reverse();
}

function moveEnemyTactically(dt,dx,dy,d,tactics){
 // Combat range depends on weapon identity rather than forcing every enemy to close.
 const gun=enemy.stats.weapon;
 const baseRange=gun.idealRange+(tactics.distance-265)*.35;
 const reloading=enemy.reloadLeft>0;
 const needsCover=(!lineOfSight(enemy,player)&&gun.id!=='rail'&&gun.id!=='missile');
 const preferred=clamp(baseRange+(reloading?145:0)-(player.reloadLeft>0?35:0),175,535);
 let approach=clamp((d-preferred)/95,-1.08,.9);
 // Reloading or badly injured enemies prefer disengagement and lateral cover.
 if(reloading&&d<preferred+65)approach=-1.08;
 if(enemy.hp/enemy.maxHp<.36&&['sniper','guardian','flanker'].includes(enemy.role))
  approach=Math.min(approach,-.65);
 const strafe=Math.sin(clock*.95+enemy.aiPhase)*enemy.aiStrafe*(reloading?.96:.58)*tactics.strafe;
 let vx=dx/d*approach-dy/d*strafe,vy=dy/d*approach+dx/d*strafe;
 enemy.aiReplan=Math.max(0,enemy.aiReplan-dt);
 enemy.aiEscapeFor=Math.max(0,enemy.aiEscapeFor-dt);
 const needsPath=(needsCover&&d>145)||enemy.aiStuckFor>.36;
 if(needsPath&&enemy.aiReplan<=0){
  enemy.aiPath=findEnemyPath(enemy.x,enemy.y,player.x,player.y);
  enemy.aiReplan=.72;
 }
 enemy.aiMode=reloading?'reload-retreat':approach<-.30?'hold-range':'seek';
 if(needsPath&&enemy.aiPath.length&&!reloading){
  while(enemy.aiPath.length&&Math.hypot(enemy.aiPath[0].x-enemy.x,enemy.aiPath[0].y-enemy.y)<25)
   enemy.aiPath.shift();
  if(enemy.aiPath.length){
   const node=enemy.aiPath[0],dist=Math.max(1,Math.hypot(node.x-enemy.x,node.y-enemy.y));
   vx=(node.x-enemy.x)/dist;vy=(node.y-enemy.y)/dist;
   enemy.aiMode='path';
  }
 }else if(!needsPath)enemy.aiPath=[];
 if(enemy.aiStuckFor>.72){
  enemy.aiStuckFor=0;enemy.aiEscapeFor=.68;enemy.aiReplan=0;
  enemy.aiPath=[];enemy.aiStrafe*=-1;
 }
 if(enemy.aiEscapeFor>0){
  const a=Math.atan2(dy,dx)+enemy.aiStrafe*Math.PI/2;
  vx=.88*Math.cos(a)-.45*dx/d;vy=.88*Math.sin(a)-.45*dy/d;
  enemy.aiMode='escape';
 }
 const mag=Math.max(1,Math.hypot(vx,vy));
 const step=enemy.status.stun>0?0:enemy.stats.speed*(reloading?.76:.62)*tactics.speed*(enemy.status.slow>0?.66:1)*dt;
 const ox=enemy.x,oy=enemy.y;
 const dodged=enemyDodgeStep(dt);
 if(!dodged)moveRobot(enemy,vx/mag*step,vy/mag*step);
 if(step>1&&Math.hypot(enemy.x-ox,enemy.y-oy)<step*.17)enemy.aiStuckFor+=dt;
 else enemy.aiStuckFor=Math.max(0,enemy.aiStuckFor-dt*1.7);
 if(dodged)enemy.aiMode='dodge';
}
function update(dt){
 if(menuOpen)return; // Opening the equipment drawer pauses combat.
 clock+=dt;
 for(let i=effects.length-1;i>=0;i--){let e=effects[i];e.life-=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=.97;e.vy*=.97;if(e.life<=0)effects.splice(i,1)}
 for(let i=rings.length-1;i>=0;i--){rings[i].life-=dt;if(rings[i].life<=0)rings.splice(i,1)}
 screenShake=Math.max(0,screenShake-17*dt);
 if(state!=='fight'||!player||!enemy)return;
 player.cd=Math.max(0,player.cd-dt);enemy.cd=Math.max(0,enemy.cd-dt);
 updateReload(player,dt);updateReload(enemy,dt);
 player.hitFlash=Math.max(0,player.hitFlash-dt);enemy.hitFlash=Math.max(0,enemy.hitFlash-dt);
 updateStatus(player,dt);updateStatus(enemy,dt);
 if(state!=='fight')return;
 updateHazards(dt);
 if(state!=='fight')return;
 player.dashCooldown=Math.max(0,player.dashCooldown-dt);player.dashLeft=Math.max(0,player.dashLeft-dt);
 const move=setInputVector();
 if(wantsDash&&player.dashCooldown<=0){wantsDash=false;
  const d=Math.hypot(move.x,move.y);
  player.vx=(d?move.x:Math.cos(player.angle))*710;player.vy=(d?move.y:Math.sin(player.angle))*710;
  player.dashLeft=player.stats.legs.id==='jet'?.29:.18;player.dashCooldown=player.stats.dashCooldown;ring(player.x,player.y,'#89f7ff',26);beep(790,.12,.022);
 }else if(wantsDash)wantsDash=false;
 if(player.dashLeft>0){moveRobot(player,player.vx*dt,player.vy*dt);particle(player.x,player.y,'#5ce4e9',2,.27)}
 else {const slow=player.status.slow>0?.66:1;moveRobot(player,move.x*player.stats.speed*slow*dt,move.y*player.stats.speed*slow*dt)}
 const autoAim=keys.Space||fireTouch||document.activeElement===$('fireDesk')||document.activeElement===$('fireTouch');
 if(autoAim)player.angle=Math.atan2(enemy.y-player.y,enemy.x-player.x);
 else player.angle=Math.atan2(aim.y-player.y,aim.x-player.x);
 if((keys.Space||fireMouse||fireTouch)&&player.status.stun<=0)shoot(player,autoAim?enemy:aim,player.angle);
 if(!enemy.dead){
  const dx=player.x-enemy.x,dy=player.y-enemy.y,d=Math.max(.001,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);
  enemy.angle=a;
  const tactics=ENEMY_ROLES[enemy.role]||ENEMY_ROLES.skirmisher;
  // Skilled enemies can top off when the player is far away or behind cover.
  if(enemy.ammo<enemy.stats.weapon.mag&&enemy.reloadLeft<=0&&
      (enemy.ammo<=0||(enemy.ammo<=Math.max(1,Math.floor(enemy.stats.weapon.mag*.28))&&
      (d>enemy.stats.weapon.idealRange+70||!lineOfSight(enemy,player)))))
   startReload(enemy);
  moveEnemyTactically(dt,dx,dy,d,tactics);
  enemy.cd=Math.max(0,enemy.cd-dt);
  if(d<tactics.attackRange&&(lineOfSight(enemy,player)||enemy.stats.weapon.id==='rail'||enemy.stats.weapon.id==='missile'))
    if(enemy.status.stun<=0)shoot(enemy,player,a+Math.sin(clock*1.4+enemySeed)*(.10+Math.min(.12,wave*.006))*tactics.accuracy);
 }
 updateBossPatterns(dt);
 if(state!=='fight')return;
 for(let i=bullets.length-1;i>=0;i--){
  let b=bullets[i];b.life-=dt;if(b.life<=0){bullets.splice(i,1);continue}
  if(b.homing){let t=b.source.enemy?player:enemy;if(t&&!t.dead){
    let a=Math.atan2(t.y-b.y,t.x-b.x),old=Math.atan2(b.vy,b.vx),diff=Math.atan2(Math.sin(a-old),Math.cos(a-old));
    old+=clamp(diff,-2.3*dt,2.3*dt);b.vx=Math.cos(old)*b.spd;b.vy=Math.sin(old)*b.spd;
  }}
  b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
  b.trail.push({x:b.x,y:b.y});if(b.trail.length>7)b.trail.shift();
  if(b.x<-20||b.x>W+20||b.y<-20||b.y>H+20){bullets.splice(i,1);continue}
  if(!b.pierce){
   const cover=blocks.find(o=>hitRect(b.x,b.y,b.r,o));
   if(cover){
    const coverDamage=b.damage*(b.kind==='slug'?1.3:b.kind==='shot'?.72:1);
    damageCover(cover,coverDamage,b.x,b.y);
    if(b.kind==='missile')blastMissileOnWall(b);
    else particle(b.x,b.y,'#88a5b5',5,.45);
    bullets.splice(i,1);continue;
   }
  }
  const tgt=b.source.enemy?player:enemy;
  if(tgt&&!tgt.dead&&Math.hypot(b.x-tgt.x,b.y-tgt.y)<b.r+tgt.r){
   damage(tgt,b.damage);applyWeaponImpact(b,tgt);ring(b.x,b.y,b.color,15);bullets.splice(i,1);
  }
 }
 updatePanels(false);
}
function roundRect(x,y,w,h,r,color){
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
// Five outer arena silhouettes, in addition to fifteen solid-cover topologies.
// Boundaries apply to robot movement (not decorative paint alone).
function arenaAllowed(x,y,r=20){
 const kind=arenaIndex()%5,dx=Math.abs(x-500),dy=Math.abs(y-295);
 if(kind===0)return x>=35+r&&x<=965-r&&y>=35+r&&y<=555-r;
 if(kind===1)return (dx/(465-r))**2+(dy/(274-r))**2<=1;
 if(kind===2)return dx<=465-r&&dy<=262-r&&dx/465+dy/262<=1.67-r/340;
 if(kind===3){
  const maxY=dx<=80?205:dx>=250?255:205+(dx-80)*50/170;
  return dx<=462-r&&dy<=maxY-r;
 }
 if(dx>462-r||dy>260-r)return false;
 if(dx<=300-r||dy<=154-r)return true;
 return ((dx-(300-r))/(162))**2+((dy-(154-r))/(106))**2<=1;
}
function arenaOutline(){
 const kind=arenaIndex()%5,p=new Path2D();
 if(kind===0)p.roundRect(35,35,930,520,14);
 else if(kind===1)p.ellipse(500,295,465,274,0,0,TAU);
 else if(kind===2){
  const ps=[[146,33],[854,33],[965,131],[965,459],[854,557],[146,557],[35,459],[35,131]];
  p.moveTo(...ps[0]);for(const v of ps.slice(1))p.lineTo(...v);p.closePath();
 }else if(kind===3){
  const ps=[[38,40],[250,40],[420,90],[580,90],[750,40],[962,40],
  [962,550],[750,550],[580,500],[420,500],[250,550],[38,550]];
  p.moveTo(...ps[0]);for(const v of ps.slice(1))p.lineTo(...v);p.closePath();
 }else p.roundRect(38,35,924,520,108);
 return p;
}
function drawArena(){
 const palettes=[
  ['#132333','#1e3445','#345267','#65909b'],
  ['#142d36','#1c4045','#37686a','#78b0a8'],
  ['#2d2539','#43314c','#67516c','#b994b0'],
  ['#172e2d','#275043','#3d7664','#87bea1'],
  ['#30283a','#4d3548','#785466','#d4a09e']
 ];
 const p=palettes[Math.floor(arenaIndex()/3)];
 ctx.fillStyle='#050d18';ctx.fillRect(0,0,W,H);
 const outline=arenaOutline();
 ctx.save();ctx.clip(outline);
 ctx.fillStyle=p[0];ctx.fillRect(0,0,W,H);
 // Layered floor tiles, in distinct per-biome palettes.
 for(let y=30,iy=0;y<H-24;y+=28,iy++)for(let x=28,ix=0;x<W-20;x+=28,ix++){
  const seed=(ix*11+iy*17+arenaIndex()*23)%19;
  mechTile(x,y,27,27,seed%7===0?p[2]:seed%3===0?p[1]:p[0]);
  mechTile(x+2,y+2,23,2,'#ffffff0b');
  mechTile(x+2,y+24,23,2,'#00000044');
  if(seed===3||seed===12){
   mechTile(x+8,y+8,12,4,p[3]);mechTile(x+8,y+13,12,4,p[3]);
  }else if(seed===7){
   for(let t=0;t<3;t++)mechTile(x+7+t*5,y+9,3,11,'#071726');
  }else if(seed===14){
   mechTile(x+7,y+7,14,14,'#0e2130');
   mechTile(x+11,y+11,6,6,p[3]);
  }else{
   mechTile(x+2,y+2,3,3,'#758d9a55');
   mechTile(x+23,y+22,3,3,'#758d9a55');
  }
 }
 // Steel rails and hazard-striping replace blurred vector illumination.
 for(let x=62;x<970;x+=164){
  mechTile(x,45,6,510,p[2]);
  for(let y=57;y<545;y+=24)mechTile(x,y,6,10,p[0]);
 }
 for(let x=48;x<W-48;x+=16){
  mechTile(x,38,8,5,x%32===0?'#c7b377':p[3]);
  mechTile(x,H-44,8,5,x%32===0?'#c7b377':p[3]);
 }
 for(const x of [165,826]){
  mechTile(x-46,268,92,3,p[3]);mechTile(x-46,320,92,3,p[3]);
  for(let k=0;k<6;k++)mechTile(x-44+k*16,271,7,48,'#0a1b2980');
 }
 ctx.restore();
 ctx.strokeStyle=p[3];ctx.lineWidth=5;ctx.stroke(outline);
}
function drawCover(){
 for(const b of blocks){
  const x=Math.round(b.x-b.w/2),y=Math.round(b.y-b.h/2),w=Math.round(b.w),h=Math.round(b.h);
  const tone=b.material==='core'?['#344557','#718396']:
   b.material==='pillar'?['#264c51','#65a29e']:
   b.material==='tower'?['#4c3e5a','#93809d']:
   b.material==='rubble'?['#5b4051','#aa737a']:['#25384b','#536d7f'];
  mechTile(x+7,y+9,w,h,'#020813a0');
  mechTile(x,y,w,h,'#081927');
  mechTile(x+4,y+4,w-8,h-8,tone[0]);
  mechTile(x+8,y+8,w-16,h-16,tone[1]);
  // Separate modular armor panels, hatches and visible damage.
  for(let xx=x+10;xx<x+w-10;xx+=24){
   mechTile(xx,y+7,9,4,'#c1ced2');
   mechTile(xx,y+h-11,9,4,'#152a3a');
  }
  for(let yy=y+10;yy<y+h-10;yy+=22){
   mechTile(x+8,yy,5,6,'#b7d0c5');
   mechTile(x+w-13,yy,5,6,'#183143');
  }
  const health=clamp(b.hp/b.maxHp,0,1);
  if(health<.8){
   mechTile(x+w*.25,y+h*.23,6,h*.4,'#112131');
   mechTile(x+w*.5,y+h*.45,Math.max(8,w*.25),6,'#112131');
   mechTile(x,y-8,w*health,4,health>.35?'#f2cd85':'#ef7e87');
  }
  if(b.material==='core'&&w>60&&h>60){
   mechTile(x+w*.35,y+h*.35,w*.3,h*.3,'#1e3c4a');
   mechTile(x+w*.4,y+h*.4,w*.2,h*.2,'#f1d18c');
  }
 }
}
/* @include-pixel-art */
function drawRobot(o){
 if(o)drawMechEquipment(o);
}
function drawBullets(){
 for(const b of bullets){
  ctx.strokeStyle=b.color;ctx.lineWidth=b.kind==='rail'?5:3;ctx.globalAlpha=.58;
  ctx.beginPath();ctx.moveTo(b.px,b.py);ctx.lineTo(b.x,b.y);ctx.stroke();
  if(b.trail.length>2){ctx.beginPath();ctx.moveTo(b.trail[0].x,b.trail[0].y);ctx.lineTo(b.x,b.y);ctx.stroke()}
  ctx.globalAlpha=1;ctx.fillStyle=b.color;
  ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(b.x,b.y,Math.max(2,b.r*.34),0,TAU);ctx.fill();
 }
}
function drawEffects(){
 for(const ring of rings){ctx.globalAlpha=ring.life/ring.max;ctx.strokeStyle=ring.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r+(1-ring.life/ring.max)*40,0,TAU);ctx.stroke()}
 for(const e of effects){ctx.globalAlpha=e.life/e.max;ctx.fillStyle=e.color;ctx.fillRect(e.x,e.y,e.size,e.size)}
 ctx.globalAlpha=1;
}
function drawHUD(){
 ctx.fillStyle='#081626b8';roundRect(48,45,185,36,9,'#0d253dcf');
 ctx.font='bold 17px ui-monospace,monospace';ctx.fillStyle='#d9f5ff';ctx.textAlign='left';ctx.fillText('ROUND '+String(wave).padStart(2,'0'),62,69);
 ctx.textAlign='right';ctx.font='bold 12px ui-monospace,monospace';ctx.fillStyle='#81b9cb';ctx.fillText(state==='fight'?'ENEMY ACTIVE':'SYSTEM IDLE',W-56,69);
 if(player&&state==='fight'){
  let ready=player.dashCooldown<=0;roundRect(47,H-82,165,32,7,ready?'#155065':'#263444');
  ctx.fillStyle=ready?'#a5faff':'#9bb0c4';ctx.textAlign='left';ctx.font='bold 12px ui-monospace,monospace';
  ctx.fillText(ready?'DASH READY':'DASH '+player.dashCooldown.toFixed(1)+'s',61,H-61);
 }
}
function isPortraitArena(){return canvas.clientHeight>canvas.clientWidth*1.14}
function render(){
 const rect=canvas.getBoundingClientRect();
 // Native low-resolution framebuffer: geometry and sprites are authored in pixels.
 const cw=Math.max(1,Math.round(rect.width/2.5)),ch=Math.max(1,Math.round(rect.height/2.5));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch}
 ctx.setTransform(1,0,0,1,0,0);
 const backdrop=ctx.createLinearGradient(0,0,cw,ch);
 backdrop.addColorStop(0,'#0d2338');backdrop.addColorStop(1,'#101e31');
 ctx.fillStyle=backdrop;ctx.fillRect(0,0,cw,ch);
 const portrait=isPortraitArena();
 // Cover the viewport while preserving a uniform scale (no stretched robots).
 // On portrait phones the arena is rotated so the player starts at the bottom
 // and the foe appears toward the top; physical joystick directions match.
 const scale=portrait?Math.max(cw/H,ch/W):Math.max(cw/W,ch/H);
 ctx.save();
 if(portrait){
  ctx.translate((cw-H*scale)/2,(ch+W*scale)/2);
  ctx.rotate(-Math.PI/2);
 }else ctx.translate((cw-W*scale)/2,(ch-H*scale)/2);
 ctx.scale(scale,scale);
 if(screenShake>0)ctx.translate(rand(-screenShake,screenShake),rand(-screenShake,screenShake));
 drawArena();drawHazards();drawCover();drawBossTelegraph();drawEffects();drawRobot(player);drawRobot(enemy);drawBullets();
 ctx.restore();
 renderPixelFrame();
}
function loop(t){let dt=Math.min(.033,(t-(loop.last||t))/1000||0);loop.last=t;update(dt);musicTick();render();requestAnimationFrame(loop)}
function mousePos(e){
 const r=canvas.getBoundingClientRect(),portrait=isPortraitArena();
 const scale=portrait?Math.max(r.width/H,r.height/W):Math.max(r.width/W,r.height/H);
 const x=e.clientX-r.left,y=e.clientY-r.top;
 if(portrait){
  aim.x=clamp(((r.height+W*scale)/2-y)/scale,0,W);
  aim.y=clamp((x-(r.width-H*scale)/2)/scale,0,H);
 }else{
  aim.x=clamp((x-(r.width-W*scale)/2)/scale,0,W);
  aim.y=clamp((y-(r.height-H*scale)/2)/scale,0,H);
 }
}
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')mousePos(e)});
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){mousePos(e);fireMouse=true;canvas.setPointerCapture(e.pointerId)}});
canvas.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')fireMouse=false});
canvas.addEventListener('pointercancel',()=>fireMouse=false);
window.addEventListener('keydown',e=>{
 if(e.code==='Escape'&&menuOpen){e.preventDefault();closeMenu();return}
 if(menuOpen)return;
 const controls=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyR'];
 if(controls.includes(e.code)&&!e.target.closest('button,input,textarea,select'))e.preventDefault();
 keys[e.code]=true;
 if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat)wantsDash=true;
 if(e.code==='KeyR'&&!e.repeat)startReload(player);
 if(e.code==='Enter'&&state==='menu')beginRun();
 if(e.code==='Enter'&&state==='dead')beginRun();
});
window.addEventListener('keyup',e=>{keys[e.code]=false});
window.addEventListener('blur',()=>{keys={};fireMouse=false;fireTouch=false;joy.x=0;joy.y=0;resetStick()});
function resetStick(){let s=$('stick');s.style.transform='translate(-50%,-50%)'}
const joyPad=$('joystick');
function setJoy(e){
 const rect=joyPad.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
 let dx=e.clientX-cx,dy=e.clientY-cy,m=Math.hypot(dx,dy),max=rect.width*.36;
 const len=Math.min(1,m/max),sx=m>0?dx/m*len:0,sy=m>0?dy/m*len:0;
 if(isPortraitArena()){joy.x=-sy;joy.y=sx}
 else{joy.x=sx;joy.y=sy}
 // Stick follows the physical finger even when the battlefield is rotated.
 $('stick').style.transform='translate(calc(-50% + '+(sx*max)+'px),calc(-50% + '+(sy*max)+'px))';
}
joyPad.addEventListener('pointerdown',e=>{e.preventDefault();activeJoyPointer=e.pointerId;joyPad.setPointerCapture(e.pointerId);setJoy(e)});
joyPad.addEventListener('pointermove',e=>{if(activeJoyPointer===e.pointerId){e.preventDefault();setJoy(e)}});
function endJoy(e){if(activeJoyPointer===e.pointerId){activeJoyPointer=null;joy.x=joy.y=0;resetStick()}}
joyPad.addEventListener('pointerup',endJoy);joyPad.addEventListener('pointercancel',endJoy);
for(const id of ['fireTouch','fireDesk']){
 let b=$(id);
 b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);fireTouch=true});
 b.addEventListener('pointerup',()=>{fireTouch=false});
 b.addEventListener('pointercancel',()=>{fireTouch=false});
 b.addEventListener('lostpointercapture',()=>{fireTouch=false});
}
for(const id of ['dashTouch','dashDesk']){$(id).addEventListener('pointerdown',e=>{e.preventDefault();wantsDash=true})}
for(const id of ['reloadTouch','reloadDesk']){
 $(id).addEventListener('pointerdown',e=>{e.preventDefault();startReload(player)});
 $(id).addEventListener('click',()=>startReload(player));
}

function closeMenu(){
 menuOpen=false;keys={};wantsDash=false;
 $('sidePanel').classList.remove('open');$('sidePanel').setAttribute('aria-hidden','true');
 $('menuShade').classList.remove('show');$('menuBtn').setAttribute('aria-expanded','false');
 $('menuBtn').setAttribute('aria-label','装備メニューを開く');
}
function openMenu(){
 menuOpen=true;fireMouse=false;fireTouch=false;keys={};wantsDash=false;joy.x=joy.y=0;resetStick();
 updatePanels(true);
 $('sidePanel').classList.add('open');$('sidePanel').setAttribute('aria-hidden','false');
 $('menuShade').classList.add('show');$('menuBtn').setAttribute('aria-expanded','true');
 $('menuBtn').setAttribute('aria-label','装備メニューを閉じる');
}
$('menuBtn').addEventListener('click',()=>menuOpen?closeMenu():openMenu());
$('menuClose').addEventListener('click',closeMenu);
$('menuShade').addEventListener('click',closeMenu);
$('soundBtn').addEventListener('click',()=>{
 soundOn=!soundOn;$('soundBtn').textContent=soundOn?'BGM ON':'BGM OFF';
 if(!soundOn){if(musicBus&&audio){musicBus.gain.cancelScheduledValues(audio.currentTime);musicBus.gain.setTargetAtTime(0,audio.currentTime,.12)}musicPlaying='silent'}
 else{musicPlaying='silent';setMusicMode(musicMode)}
});
// Start button is dynamically bound by renderHangar.
// Read-only telemetry for browser QA; it cannot mutate combat state.
// Test-only integration hook, available to browser automation but not ordinary players.
if(navigator.webdriver)window.__roboQATest={
 defeatEnemy:()=>{if(!enemy||state!=='fight')return;enemy.shieldCooldown=9999;enemy.status.burn=0;damage(enemy,enemy.hp/(1-enemy.stats.guard)+500)},
 setHealth:value=>{if(player){player.hp=clamp(value,1,player.maxHp);updatePanels(false)}},
 setGold:value=>{gold=Math.max(0,Math.floor(value));updatePanels(true)},
 grantMetaPoints:value=>{if(state!=='menu')return false;metaState.points+=Math.max(0,Math.floor(value));saveMeta();renderHangar();return true},
 // Integration-only: force a one-round magazine to validate auto reload.
 setAmmo:value=>{if(!player||state!=='fight')return false;
  player.reloadLeft=0;player.ammo=clamp(Math.floor(value),0,player.stats.weapon.mag);return true},


 enemyBuilds:()=>ENEMY_ARCHETYPES.map(profile=>({id:profile.id,role:profile.role,parts:profile.parts,
  combinations:findBuildSynergies({...initial(),...Object.fromEntries(Object.entries(profile.parts).map(([slot,id])=>[slot,part(slot,id)]))}).map(x=>x.id)})),
 inspectBuild:parts=>{
  const load=initial();
  for(const [slot,id] of Object.entries(parts||{})){
   if(!SLOT[slot]||!DEF[slot].some(d=>d.id===id))return null;
   load[slot]=part(slot,id);
  }
  const spec=specs(load);
  return {ids:spec.synergies.map(x=>x.id),hp:spec.hp,
   damage:spec.dmg,guard:spec.guard,speed:spec.speed,
   fireCooldown:spec.fireCooldown,modifiers:spec.modifiers};
 },
 equipTestPart:(slot,id)=>{
  if(!player||!SLOT[slot]||!DEF[slot].some(d=>d.id===id))return false;
  player.load[slot]=part(slot,id);restoreVitalsFromLoad();return true;
 },
 defeatPlayer:()=>{
  if(!player||state!=='fight')return false;
  player.dashLeft=0;player.shieldCooldown=9999;
  damage(player,player.hp/(Math.max(.01,1-player.stats.guard)*.86)+500);
  return state==='loseCard';
 },
 testBreakCover:()=>{
  if(state!=='fight'||!blocks.length)return null;
  const cover=blocks[0],before=blocks.length;
  const removed=damageCover(cover,cover.maxHp+10);
  const oldX=cover.x,oldY=cover.y;
  return {removed,before,after:blocks.length,unblocked:!blocks.some(b=>hitRect(oldX,oldY,3,b))};
 },
 testWeaponTrait:kind=>{
  if(state!=='fight'||!enemy||!WEAPON_TRAITS[kind])return null;
  enemy.status={burn:0,stun:0,slow:0,sunder:0};
  const a={kind,source:player,color:'#ffffff'};
  applyWeaponImpact(a,enemy);
  return {...enemy.status};
 },
 testHazard:kind=>{
  if(state!=='fight'||!HAZARD_KINDS.includes(kind))return null;
  const before=player.hp,old=hazards,st={...player.status};
  player.hp=player.maxHp*.5;player.status={burn:0,stun:0,slow:0,sunder:0};
  hazards=[{kind,x:player.x,y:player.y,r:75,phase:.6,cooldown:0}];
  const start=player.hp;updateHazards(.20);
  const answer={hpDelta:player.hp-start,slow:player.status.slow};
  hazards=old;player.hp=before;player.status=st;updatePanels(false);
  return answer;
 },
 testEnemyDodge:()=>{
  if(state!=='fight')return null;
  const previousRole=enemy.role,prev=enemy.aiDodgeCooldown;
  enemy.role='flanker';enemy.aiDodgeCooldown=0;
  const ox=enemy.x,oy=enemy.y;
  const fake={source:player,x:enemy.x-100,y:enemy.y,vx:600,vy:0,spd:600};
  bullets.push(fake);
  const triggered=enemyDodgeStep(.16);bullets.pop();
  const distance=Math.hypot(enemy.x-ox,enemy.y-oy);
  enemy.role=previousRole;enemy.aiDodgeCooldown=prev;
  return {triggered,distance};
 },
 testBossPattern:kind=>{
  if(state!=='fight'||currentNode!=='boss'||!['fan','ring','beam','salvo'].includes(kind))return null;
  const count=bossAttackCount,bulletsBefore=bullets.length;
  bossAttack={kind,windup:.001,angle:Math.atan2(player.y-enemy.y,player.x-enemy.x)};
  updateBossPatterns(.01);
  return {fired:bossAttackCount-count,bulletsAdded:bullets.length-bulletsBefore,phase:enemy.hp/enemy.maxHp<.5?2:1};
 },
 sampleHazardKinds:()=>{
  const saved=depth,types=new Set();
  for(let i=0;i<15;i++){depth=i;for(const h of makeHazards())types.add(h.kind)}
  depth=saved;return [...types];
 },
 setBossHpRatio:ratio=>{if(enemy&&currentNode==='boss'){enemy.hp=enemy.maxHp*clamp(ratio,.01,1);updatePanels(false)}},
 forceNextEventVariant:id=>{if(!EVENT_VARIANTS.some(v=>v.id===id))return false;forcedEventVariant=id;return true},
 selectNode:type=>{if(state==='route'){routeCandidates=[{lane:currentLane,type}];routeOptions=[type];enterNode(type,currentLane)}},
 jumpToBoss:()=>{if(state==='route'){depth=10;wave=11;showRoute()}},
 sampleLayouts:()=>{const saved=depth,seen=[];for(let i=0;i<15;i++){depth=i;seen.push(makeCover().map(b=>Math.round(b.x/10)+','+Math.round(b.y/10)).join(';'))}depth=saved;return seen},
 sampleLayoutShapes:()=>{const saved=depth,seen=[];for(let i=0;i<15;i++){depth=i;const b=makeCover();seen.push({layout:arenaIndex(),count:b.length,area:Math.round(b.reduce((a,x)=>a+x.w*x.h,0)),kinds:[...new Set(b.map(x=>x.material))],rects:b.map(x=>({x:x.x,y:x.y,w:x.w,h:x.h}))})}depth=saved;return seen},
 sampleArenaAccess:()=>{
  const saved=depth,report=[];
  const cols=30,rows=19,cell=(i,j)=>({x:120+i*26,y:61+j*26});
  for(let k=0;k<15;k++){
   depth=k;const obs=makeCover(),pass=(i,j)=>{
    if(i<0||i>=cols||j<0||j>=rows)return false;
    const p=cell(i,j);
    return arenaAllowed(p.x,p.y,22)&&!obs.some(b=>hitRect(p.x,p.y,22,b));
   };
   const queue=[[2,9]],seen=new Set(),key=(i,j)=>i+','+j;
   while(queue.length){
    const [i,j]=queue.shift(),id=key(i,j);if(seen.has(id)||!pass(i,j))continue;
    seen.add(id);
    for(const [di,dj] of [[0,1],[0,-1],[1,0],[-1,0]])queue.push([i+di,j+dj]);
   }
   report.push({layout:arenaIndex(),type:arenaIndex()%5,
      playerSafe:pass(2,9),enemySafe:pass(28,9),
      reachable:seen.has(key(28,9)),openCells:seen.size});
  }
  depth=saved;return report;
 }
};
window.__roboQA=()=>({
 state,wave,shotsFired,lootTaken,best,menuOpen,enemyDamageMultiplier:.86,portraitArena:isPortraitArena(),
 meta:{points:metaState.points,runs:metaState.runs,earned:metaState.earned,starter:metaState.starter,upgrades:{...metaState.upgrades},settled:runSettled,totalCost:META_COSTS.reduce((a,b)=>a+b,0)*Object.keys(META_UPGRADES).length,midRunAward:45+5*7+3*8},
 rail:{damage:DEF.weapon.find(w=>w.id==='rail').damage,cooldown:DEF.weapon.find(w=>w.id==='rail').cool,penetratesCover:true},
 spriteSilhouettes:Object.fromEntries(Object.entries(SPRITE_SILHOUETTES).map(([slot,parts])=>[slot,Object.values(parts)])),
 depth,gold,encountersWon,currentNode,eventVariant:activeEventVariant,currentLane,routeOptions:routeOptions.slice(),routeCandidates:routeCandidates.map(c=>({...c})),routeGraph:routeGraph.map(r=>r.slice()),chosenNodes:chosenNodes.map(n=>({...n})),bossCleared,mapHistory:mapHistory.slice(),arenaLayout:arenaIndex(),arenaLayoutCount:15,
 partCounts:Object.fromEntries(Object.keys(DEF).map(k=>[k,DEF[k].length])),weaponTraits:Object.keys(WEAPON_TRAITS),
 synergyCount:SYNERGY_RULES.length,playerSynergies:player?.stats.synergies.map(rule=>rule.id)||[],
 enemyArchetype:chosenEnemyArchetype?.id||null,enemyArchetypeCount:ENEMY_ARCHETYPES.length,
 enemySynergies:enemy?.stats.synergies.map(rule=>rule.id)||[],
 bgmMode:musicMode,pixelMode:PIXEL_RENDER_MODE.enabled,pixelBuffer:{width:MECH_PIXELS.width,height:MECH_PIXELS.height},
 roles:Object.keys(ENEMY_ROLES),
 coverCount:blocks.length,coverArea:Math.round(blocks.reduce((a,b)=>a+b.w*b.h,0)),coverDurability:blocks.map(b=>({material:b.material,hp:b.hp,maxHp:b.maxHp})),
 hazards:hazards.map(h=>({kind:h.kind,x:h.x,y:h.y,r:h.r,phase:h.phase})),hazardKinds:HAZARD_KINDS.slice(),
 bossPattern:bossAttack?.kind||null,bossAttackCount,bossPhase:enemy&&currentNode==='boss'?(enemy.hp/enemy.maxHp<.5?2:1):0,
 player:player?{x:player.x,y:player.y,hp:player.hp,maxHp:player.maxHp,
  dashCooldown:player.dashCooldown,status:{...player.status},load:player.load}:null,
 enemy:enemy?{x:enemy.x,y:enemy.y,hp:enemy.hp,maxHp:enemy.maxHp,
  role:enemy.role,status:{...enemy.status},load:enemy.load}:null,
 bullets:bullets.length,lootCards:document.querySelectorAll('[data-loot]').length,
 magazineSpecs:Object.fromEntries(DEF.weapon.map(w=>[w.id,{mag:w.mag,reload:w.reload,idealRange:w.idealRange}])),
 enemyDistance:player&&enemy?Math.hypot(player.x-enemy.x,player.y-enemy.y):null,
 playerAmmo:player?{ammo:player.ammo,mag:player.stats.weapon.mag,reloadLeft:player.reloadLeft,reloadCount:player.reloadCount,shots:player.shots}:null,
 enemyAmmo:enemy?{ammo:enemy.ammo,mag:enemy.stats.weapon.mag,reloadLeft:enemy.reloadLeft,reloadCount:enemy.reloadCount,shots:enemy.shots,aiMode:enemy.aiMode}:null
});
const previewLoad=initial();
player=createRobot(previewLoad,240,295);
enemy=createRobot(makeEnemyLoadout(1),760,295,true);
blocks=makeCover();updatePanels(true);renderHangar();
requestAnimationFrame(loop);
})();

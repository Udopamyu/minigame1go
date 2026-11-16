/*
 * 4-SLOT BUILD SYNERGIES
 *
 * These are deliberately compositional bonuses. Players still equip just
 * weapon, armor, legs and core: no extra slots, premium currency, or permanent
 * meta-upgrades are introduced. A run can activate multiple non-conflicting
 * combinations. Every rule has both a gameplay effect and a concise Japanese
 * explanation for the equipment drawer.
 *
 * Multipliers are bounded in resolveSynergies so random high-tier equipment
 * does not produce runaway fire rates or damage.
 */
const SYNERGY_RULES=[
 {
  id:'plasma-loop',
  name:'プラズマ循環',
  description:'パルスガン＋バランスコア：連射間隔12%短縮・感電時間35%増加',
  requires:{weapon:['pulse'],core:['balance']},
  modifiers:{fireCooldown:.88,stun:1.35}
 },
 {
  id:'ion-capacitor',
  name:'イオン過給',
  description:'パルスガン＋タクティカル：攻撃15%増加・移動速度5%低下',
  requires:{weapon:['pulse'],core:['tactical']},
  modifiers:{damage:1.15,speed:.95}
 },
 {
  id:'shock-armor',
  name:'静電防壁',
  description:'プリズム装甲＋バランス：防御率3.5pt増加・感電時間22%増加',
  requires:{armor:['prism'],core:['balance']},
  modifiers:{guard:.035,stun:1.22}
 },
 {
  id:'close-quarters',
  name:'突撃散弾',
  description:'スプレッド砲＋ジェット脚：移動7%増加・吹き飛ばし40%増加',
  requires:{weapon:['shot'],legs:['jet']},
  modifiers:{speed:1.07,push:1.4}
 },
 {
  id:'moving-fortress',
  name:'移動要塞',
  description:'フォートレス装甲＋クローラー脚：大幅な最大HP増加、鈍足',
  requires:{armor:['fortress'],legs:['crawler']},
  modifiers:{hp:1.22,guard:.018,speed:.88}
 },
 {
  id:'siege-rail',
  name:'攻城砲フレーム',
  description:'レールランサー＋キャタピラ：高火力、移動は鈍重',
  requires:{weapon:['rail'],legs:['tank','crawler']},
  modifiers:{damage:1.19,speed:.91,sunder:1.28}
 },
 {
  id:'ranger-rail',
  name:'機動狙撃',
  description:'レールランサー＋レンジャー脚：攻撃後の機動力を強化',
  requires:{weapon:['rail'],legs:['ranger']},
  modifiers:{speed:1.12,fireCooldown:.94}
 },
 {
  id:'salvo-control',
  name:'集中制圧',
  description:'バーストライフル＋スピード：連射間隔12%短縮・炎上時間30%増加',
  requires:{weapon:['burst'],core:['speed']},
  modifiers:{fireCooldown:.88,burn:1.3}
 },
 {
  id:'burn-engine',
  name:'火炎炉',
  description:'バーストライフル＋パワー：炎上時間60%増加・攻撃9%増加',
  requires:{weapon:['burst'],core:['power']},
  modifiers:{burn:1.6,damage:1.09}
 },
 {
  id:'swarm-tactics',
  name:'蜂群ドクトリン',
  description:'ニードルガン＋スピード：連射間隔12%短縮・装甲破砕時間50%増加',
  requires:{weapon:['micro'],core:['speed']},
  modifiers:{fireCooldown:.88,sunder:1.5}
 },
 {
  id:'missile-platform',
  name:'ミサイル架台',
  description:'ホーミング弾＋キャタピラ：爆風範囲が拡大',
  requires:{weapon:['missile'],legs:['tank','crawler']},
  modifiers:{splash:1.35,damage:1.08}
 },
 {
  id:'guided-evasion',
  name:'追跡と回避',
  description:'ホーミング弾＋ブースター：移動13%増加・防御率1pt増加',
  requires:{weapon:['missile'],legs:['booster']},
  modifiers:{speed:1.13,guard:.01}
 },
 {
  id:'heavy-slug',
  name:'重力破砕',
  description:'グラビティスラグ＋重装甲：ノックバックと耐久力を増強',
  requires:{weapon:['slug'],armor:['fortress','plated']},
  modifiers:{push:1.4,hp:1.12}
 },
 {
  id:'slug-jet',
  name:'強襲ハンマー',
  description:'グラビティスラグ＋ジェット脚：移動10%増加・攻撃10%増加',
  requires:{weapon:['slug'],legs:['jet']},
  modifiers:{speed:1.1,damage:1.1}
 },
 {
  id:'reactive-aegis',
  name:'反応防壁',
  description:'リアクティブ装甲＋バランス：防御率4.5pt増加・反応装甲の被ダメージ減少',
  requires:{armor:['reactive'],core:['balance']},
  modifiers:{guard:.045,reactive:.75}
 },
 {
  id:'field-repair',
  name:'自己修復',
  description:'コンポジット装甲＋タクティカル：戦闘後回復率9pt増加',
  requires:{armor:['composite'],core:['tactical']},
  modifiers:{repair:.09}
 },
 {
  id:'light-escape',
  name:'逃走回路',
  description:'フェザー装甲＋レンジャー脚：移動14%増加・防御率1.5pt増加',
  requires:{armor:['feather'],legs:['ranger','spider']},
  modifiers:{speed:1.14,guard:.015}
 },
 {
  id:'recycle-tank',
  name:'廃材再生',
  description:'重装甲＋パワー：最大HP9%増加・戦闘後回復率8pt増加',
  requires:{armor:['plated','fortress','composite'],core:['power']},
  modifiers:{hp:1.09,repair:.08}
 },
 {
  id:'wheel-shield',
  name:'ローリングガード',
  description:'ローラー脚＋バランス：移動8%増加・防御率1.5pt増加',
  requires:{legs:['wheel'],core:['balance']},
  modifiers:{speed:1.08,guard:.015}
 },
 {
  id:'prism-capacitor',
  name:'高出力防衛',
  description:'プリズム装甲＋タクティカル：防御率2pt増加・連射間隔7%短縮',
  requires:{armor:['prism'],core:['tactical']},
  modifiers:{guard:.02,fireCooldown:.93}
 }
];

/* Numeric combo descriptions use the actual combat modifiers. */
const SYNERGY_METRIC_LABELS={
 hp:'最大HP',damage:'攻撃力',speed:'移動速度',fireCooldown:'射撃間隔',
 dashCooldown:'ダッシュ待機',guard:'防御率',repair:'戦闘後回復率',
 stun:'スタン時間',slow:'減速時間',sunder:'装甲破砕時間',
 burn:'炎上時間',push:'吹き飛ばし距離',splash:'爆風範囲',
 reactive:'反応装甲の被ダメージ'
};
function synergyPercent(value){return Number((value*100).toFixed(1)).toString();}
function synergyEffectText(rule){
 return Object.entries(rule.modifiers).map(([key,value])=>{
  const name=SYNERGY_METRIC_LABELS[key]||key;
  if(key==='guard'||key==='repair')return name+(value>=0?'+':'')+synergyPercent(value)+'pt';
  const change=Number(((value-1)*100).toFixed(1));
  return name+(change>0?'+':'')+change+'%';
 }).join('・');
}
function synergyConditionText(rule){return rule.description.split('：')[0];}

const SYNERGY_DEFAULT={
 hp:1,damage:1,speed:1,fireCooldown:1,dashCooldown:1,
 guard:0,repair:0,stun:1,slow:1,sunder:1,burn:1,
 push:1,splash:1,reactive:1
};

function findBuildSynergies(load){
 if(!load||!load.weapon||!load.armor||!load.legs||!load.core)return [];
 return SYNERGY_RULES.filter(rule=>
  Object.entries(rule.requires).every(([slot,ids])=>
   Boolean(load[slot])&&ids.includes(load[slot].id)));
}

function resolveBuildSynergies(load){
 const active=findBuildSynergies(load);
 const modifiers={...SYNERGY_DEFAULT};
 for(const rule of active){
  for(const [stat,value] of Object.entries(rule.modifiers)){
   if(stat==='guard'||stat==='repair'){
    modifiers[stat]+=value;
   }else{
    modifiers[stat]*=value;
   }
  }
 }
 // Limit stacked synergies so synergy hunting is rewarding but not explosive.
 const bounds={
  hp:[.7,1.55],damage:[.7,1.65],speed:[.72,1.5],
  fireCooldown:[.65,1.4],dashCooldown:[.65,1.35],
  stun:[1,2],slow:[1,2],sunder:[1,2],burn:[1,2],
  push:[1,1.8],splash:[1,1.8],reactive:[.5,1.2]
 };
 for(const [stat,[min,max]] of Object.entries(bounds))
  modifiers[stat]=clamp(modifiers[stat],min,max);
 modifiers.guard=clamp(modifiers.guard,0,.11);
 modifiers.repair=clamp(modifiers.repair,0,.24);
 return {active,modifiers};
}

function buildComparison(previous,candidate){
 const oldStats=specs(previous,true);
 const newStats=specs(candidate,true);
 const pairs=[
  {name:'弾倉',old:oldStats.mag,next:newStats.mag,digits:0,higher:true},
  {name:'装填時間',old:oldStats.reloadTime,next:newStats.reloadTime,digits:2,higher:false},
  {name:'最大HP',old:oldStats.hp,next:newStats.hp,digits:0,higher:true},
  {name:'攻撃威力',old:oldStats.dmg,next:newStats.dmg,digits:0,higher:true},
  {name:'連射間隔',old:oldStats.fireCooldown,next:newStats.fireCooldown,digits:2,higher:false},
  {name:'防御率',old:oldStats.guard,next:newStats.guard,digits:0,higher:true,percent:true},
  {name:'移動速度',old:oldStats.speed,next:newStats.speed,digits:0,higher:true}
 ];
 return {
  old:oldStats,new:newStats,
  diffs:pairs.map(metric=>{
   const prev=metric.percent?metric.old*100:metric.old;
   const next=metric.percent?metric.next*100:metric.next;
   return {...metric,previous:Number(prev.toFixed(metric.digits)),
    current:Number(next.toFixed(metric.digits)),
    improved:metric.higher?next>prev:next<prev,
    worsened:metric.higher?next<prev:next>prev};
  }),
  gains:newStats.synergies.filter(rule=>!oldStats.synergies.some(old=>old.id===rule.id)),
  losses:oldStats.synergies.filter(rule=>!newStats.synergies.some(next=>next.id===rule.id))
 };
}

function buildComparisonMarkup(previous,candidate){
 const result=buildComparison(previous,candidate);
 const main=result.diffs.filter(d=>Math.abs(d.old-d.next)>0.04).slice(0,3);
 let html='<div class="compareStats">';
 for(const metric of main){
  const color=metric.improved?'good':metric.worsened?'bad':'neutral';
  const arrow=metric.improved?'↑':metric.worsened?'↓':'→';
  html+='<span class="compareStat '+color+'">'+metric.name+' '
   +metric.previous+(metric.percent?'%':'')+' '+arrow+' '
   +metric.current+(metric.percent?'%':'')+'</span>';
 }
 if(!main.length)html+='<span class="compareStat neutral">基礎性能は同等</span>';
 html+='</div>';
 if(result.gains.length)
  html+='<div class="compareSynergy">コンボ発動：'
   +result.gains.map(x=>x.name+'【'+synergyEffectText(x)+'】').join('／')+'</div>';
 if(result.losses.length)
  html+='<div class="compareLoss">失うコンボ：'
   +result.losses.map(x=>x.name).join('、')+'</div>';
 return html;
}

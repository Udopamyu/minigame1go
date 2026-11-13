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
  description:'パルスガン＋スパークコア：連射と感電性能が上昇',
  requires:{weapon:['pulse'],core:['spark']},
  modifiers:{fireCooldown:.88,stun:1.35}
 },
 {
  id:'ion-capacitor',
  name:'イオン過給',
  description:'パルスガン＋キャパシタ：高威力だが移動速度が少し低下',
  requires:{weapon:['pulse'],core:['capacitor']},
  modifiers:{damage:1.15,speed:.95}
 },
 {
  id:'shock-armor',
  name:'静電防壁',
  description:'プリズム装甲＋スパーク：守備力と感電時間を強化',
  requires:{armor:['prism'],core:['spark']},
  modifiers:{guard:.035,stun:1.22}
 },
 {
  id:'close-quarters',
  name:'突撃散弾',
  description:'スプレッド砲＋ジェット脚：ダッシュ短縮と吹き飛ばし強化',
  requires:{weapon:['shot'],legs:['jet']},
  modifiers:{dashCooldown:.82,push:1.4}
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
  description:'バーストライフル＋ラピッドコア：連射性能と炎上時間を強化',
  requires:{weapon:['burst'],core:['rapid']},
  modifiers:{fireCooldown:.88,burn:1.3}
 },
 {
  id:'burn-engine',
  name:'火炎炉',
  description:'バーストライフル＋ブレイズ：燃焼が長く、攻撃威力が高い',
  requires:{weapon:['burst'],core:['blaze']},
  modifiers:{burn:1.6,damage:1.09}
 },
 {
  id:'swarm-tactics',
  name:'蜂群ドクトリン',
  description:'ニードルガン＋ラピッド：高連射と装甲破砕を強化',
  requires:{weapon:['micro'],core:['rapid']},
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
  description:'ホーミング弾＋ブースター：機動力と回避性能が上昇',
  requires:{weapon:['missile'],legs:['booster']},
  modifiers:{speed:1.13,dashCooldown:.90}
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
  description:'グラビティスラグ＋ジェット脚：瞬発力と威力を増強',
  requires:{weapon:['slug'],legs:['jet']},
  modifiers:{dashCooldown:.85,damage:1.1}
 },
 {
  id:'reactive-aegis',
  name:'反応防壁',
  description:'リアクティブ装甲＋イージス：被弾時の軽減が強化',
  requires:{armor:['reactive'],core:['aegis']},
  modifiers:{guard:.045,reactive:.75}
 },
 {
  id:'field-repair',
  name:'自己修復',
  description:'コンポジット装甲＋リペア：戦闘後回復量を増加',
  requires:{armor:['composite'],core:['repair']},
  modifiers:{repair:.09}
 },
 {
  id:'light-escape',
  name:'逃走回路',
  description:'フェザー装甲＋レンジャー脚：機動力とダッシュ性能を強化',
  requires:{armor:['feather'],legs:['ranger','spider']},
  modifiers:{speed:1.14,dashCooldown:.80}
 },
 {
  id:'recycle-tank',
  name:'廃材再生',
  description:'重装甲＋サルベージコア：耐久と戦闘後回復を増加',
  requires:{armor:['plated','fortress','composite'],core:['salvager']},
  modifiers:{hp:1.09,repair:.08}
 },
 {
  id:'wheel-shield',
  name:'ローリングガード',
  description:'ローラー脚＋イージス：回避の再使用が速く防御力も増加',
  requires:{legs:['wheel'],core:['aegis']},
  modifiers:{dashCooldown:.83,guard:.015}
 },
 {
  id:'prism-capacitor',
  name:'高出力防衛',
  description:'プリズム装甲＋キャパシタ：ガードと連射性能を強化',
  requires:{armor:['prism'],core:['capacitor']},
  modifiers:{guard:.02,fireCooldown:.93}
 }
];

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
 const oldStats=specs(previous);
 const newStats=specs(candidate);
 const pairs=[
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
  html+='<div class="compareSynergy">新コンボ：'
   +result.gains.map(x=>x.name).join('、')+'</div>';
 if(result.losses.length)
  html+='<div class="compareLoss">失うコンボ：'
   +result.losses.map(x=>x.name).join('、')+'</div>';
 return html;
}

'use strict';
// Pure doubles analysis. Each of two opponents may have one or two selected types.
// Shared source: TYPES/effectiveness/damageTaken + team.json + battle-data.json.
// Ordered criteria and Pareto fronts; no weighted score, simulated HP or KO claim.
function doublePairs(team){return team.flatMap((p,i)=>team.slice(i+1).map(q=>[p,q]))}
function doubleCompare(a,b){return quickCompareKeys(a,b)}
function doubleFacts(name,data){return {...(data.confirmedMoveFacts?.[name]||{}),...(data.doublesMechanics?.[name]||{})}}
function doubleTypeSets(opponents){return opponents.map(entry=>{const types=Array.isArray(entry)?entry:entry&&Array.isArray(entry.types)?entry.types:[entry];return types.filter(Boolean)})}
function doubleOpponentLabel(opponents,i){return doubleTypeSets(opponents)[i].map(t=>TYPES[t]).join('/')}
function doubleMove(p,move,opponents,data){
 const [name,type]=move,facts=doubleFacts(name,data),target=facts.target||'unknown';
 const stats=quickStats(p,data),offenseBase=stats?.[facts.category==='physical'?'atk':facts.category==='special'?'spa':''];
 const known=Number.isFinite(facts.power)&&Number.isFinite(offenseBase),effectivePower=facts.powerDoublesWithoutItem&&p.item===null?facts.power*2:facts.power;
 const typeSets=doubleTypeSets(opponents);
 return {power:effectivePower,offenseBase,known,precision:facts.accuracyMode==='bypass'?'bypass':facts.accuracy,precisionTier:p.ability==='No Guard'||facts.accuracyMode==='bypass'?0:facts.accuracy===100?1:Number.isFinite(facts.accuracy)?2:3,name,type,facts,target,owner:p.name,stab:!!type&&p.types.includes(type),conditional:!!facts.conditional||QUICK_CONDITIONAL.has(name),priority:!!type&&(Number.isFinite(facts.priority)?facts.priority>0:(data.highPriority||[]).includes(name)),effectiveness:type?typeSets.map(types=>effectiveness(type,types)):[0,0]};
}
function doubleAllyImpact(move,partner){
 if(move.target!=='all-others')return null;
 const byTypes=effectiveness(move.type,partner.types),received=damageTaken(move.type,partner);
 return {partner:partner.name,multiplier:received,natural:byTypes===0,ability:byTypes!==0&&received===0,heals:move.type==='water'&&partner.ability==='Water Absorb',protected:false};
}
function doubleActions(p,partner,opponents,data){
 const moves=p.moves.filter(m=>m[1]).map(m=>doubleMove(p,m,opponents,data));
 const sustained=moves.filter(m=>!m.conditional),pool=sustained.length?sustained:moves;
 const actions=[];
 pool.forEach(m=>{
  if(['both-opponents','all-others'].includes(m.target)){
   const impact=doubleAllyImpact(m,partner);
   // An unprotected ally taking damage is a real cost; do not promote this
   // option as a safe plan. Keep its evidence separately for the warning.
   if(impact&&impact.multiplier>0)return;
   actions.push({...m,targets:[0,1],coverage:m.effectiveness.slice(),allyImpact:impact});
  }else if(m.target==='selected-opponent'){
   [0,1].forEach(target=>actions.push({...m,targets:[target],coverage:m.effectiveness.map((n,i)=>i===target?n:0),allyImpact:null}));
  }
 });
 return actions.length?actions:[{name:null,owner:p.name,type:null,targets:[],coverage:[0,0],stab:false,priority:false,conditional:false}];
}
function doubleOffense(pair,opponents,data){
 const choices=pair.map((p,i)=>doubleActions(p,pair[1-i],opponents,data)),plans=[];
 const stats=pair.map(p=>quickStats(p,data)),speedKnown=stats.every(Boolean);
 // Missing any offensive fact disables that comparison for the entire roster.
 // This prevents an unknown value from silently becoming zero or losing a tie.
 const pressureKnown=data.pressureComparable!==false&&choices.flat().every(m=>!m.name||m.known);
 const pressure=(m,i)=>m.name&&m.coverage[i]>0&&m.known?m.power*(m.stab?1.5:1)*m.offenseBase*m.coverage[i]:0;
 for(const a of choices[0])for(const b of choices[1]){
  const actions=[a,b],coverage=[0,1].map(i=>Math.max(a.coverage[i],b.coverage[i]));
  const potentials=pressureKnown?[0,1].map(i=>Math.max(...actions.map(m=>pressure(m,i)))):[0,0];
  const sorted=coverage.slice().sort((x,y)=>x-y),pot=potentials.slice().sort((x,y)=>x-y),speeds=speedKnown?stats.map(s=>s.spe).sort((x,y)=>x-y):[0,0];
  const reliability=actions.filter(m=>m.name).map(m=>m.precisionTier).sort((x,y)=>y-x);
  while(reliability.length<2)reliability.push(3);
  const checkedAccuracy=actions.filter(m=>Number.isFinite(m.precision)).map(m=>-m.precision).sort((x,y)=>y-x);
  // Never assign a conventional percentage to bypass accuracy.
  const accuracyTie=reliability.every(n=>n===2)?checkedAccuracy:[0,0];
  const key=[coverage.filter(n=>n===0).length,-sorted[0],-sorted[1],...pot.map(n=>-n),...reliability,...accuracyTie,-actions.filter(m=>m.priority&&!m.conditional).length,-speeds[0],-speeds[1]];
  plans.push({actions,coverage,potentials,pressureKnown,key,spread:actions.some(m=>m.targets.length===2)});
 }
 plans.sort((a,b)=>doubleCompare(a.key,b.key));return plans[0];
}
function doubleDominates(a,b){return a.every((n,i)=>n<=b[i])&&a.some((n,i)=>n<b[i])}
function doubleFronts(rows,vector,assign){
 let left=rows.slice(),front=0;
 while(left.length){const winners=left.filter(a=>!left.some(b=>a!==b&&doubleDominates(vector(b),vector(a))));winners.forEach(r=>r[assign]=front);left=left.filter(r=>!winners.includes(r));front++}
}
function doubleSupport(pair,opponents,data){
 const notes=[];
 pair.forEach((p,index)=>{
  const partner=pair[1-index];
  if(p.ability==='Intimidate')notes.push({kind:'intimidate',owner:p.name,text:`${p.name}: Intimidate pode reduzir o Ataque dos dois adversários ao entrar, se forem afetados. Ajuda ambos os aliados contra golpes físicos; não reduz dano especial nem é reaplicado por permanecer.`});
  if(p.ability==='No Guard')notes.push({kind:'no-guard',owner:p.name,text:`${p.name}: No Guard também permite que os golpes dirigidos a ele não errem; não melhora a precisão do parceiro.`});
  p.moves.forEach(m=>{
   const move=doubleMove(p,m,opponents,data),f=move.facts;
   if(f.role==='fake-out'){
    const targets=opponents.map((_,i)=>move.effectiveness[i]>0?String.fromCharCode(65+i):null).filter(Boolean);
    notes.push({kind:'fake-out',owner:p.name,targets,text:targets.length?`${p.name}: Fake Out pode interromper o adversário ${targets.join(' ou ')}, apenas no primeiro turno após entrar e se não houver proteção ou imunidade. Disponibilidade neste turno desconhecida.`:`${p.name}: Fake Out é anulado pelos tipos Fantasma selecionados. Não conte com a interrupção.`});
   }
   if(f.role==='protect')notes.push({kind:'protect',owner:p.name,text:`${p.name}: Protect protege o próprio usuário enquanto ${partner.name} pode agir. Não protege diretamente o parceiro; repetições não têm sucesso garantido.`});
   if(f.role==='pivot')notes.push({kind:'pivot',owner:p.name,text:`${p.name}: Parting Shot reduz Ataque/SpA dos alvos afetados e permite recuar, se funcionar. Alcance em duplas não confirmado; sem bônus por afetar ambos. Consome sua ação.`});
   if(f.role==='heal-ally')notes.push({kind:'heal-ally',owner:p.name,text:`${p.name}: Heal Pulse pode recuperar HP de ${partner.name}, consumindo a ação de ${p.name}. Não cura o próprio usuário e não garante sobreviver até agir.`});
   if(m[0]==='Swords Dance')notes.push({kind:'setup',owner:p.name,text:`${p.name}: Swords Dance aumenta o Ataque físico em dois estágios, usa um turno e não impede os dois adversários de focarem nele. Nenhum boost foi aplicado.`});
   if(m[0]==='Calm Mind')notes.push({kind:'setup',owner:p.name,text:`${p.name}: Calm Mind aumenta Ataque Especial e Defesa Especial em um estágio, usa um turno e não impede os dois adversários de focarem nele. Nenhum boost foi aplicado.`});
   if(f.powerDoublesWithoutItem)notes.push({kind:'item',owner:p.name,text:`${p.name}: Acrobatics tem STAB, mas o bônus sem item não foi presumido. O item equipado precisa estar confirmado.`});
  });
 });
 return notes;
}
function doubleEvaluate(pair,opponents,data){
 const typeSets=doubleTypeSets(opponents);
 const matrix=pair.map(p=>typeSets.map((types,index)=>{const threats=types.map(type=>({type,byTypes:effectiveness(type,p.types),multiplier:damageTaken(type,p),abilityImmunity:effectiveness(type,p.types)!==0&&damageTaken(type,p)===0,solidRock:effectiveness(type,p.types)>1&&p.ability==='Solid Rock'}));return {types,threats,type:types[0],byTypes:threats[0]?.byTypes??1,multiplier:Math.max(...threats.map(x=>x.multiplier)),abilityImmunity:threats.some(x=>x.abilityImmunity),solidRock:threats.some(x=>x.solidRock)}}));
 const values=matrix.flatMap(row=>row.flatMap(cell=>cell.threats.map(x=>x.multiplier))).sort((a,b)=>b-a);
 const shared=typeSets.map((types,i)=>types.some(type=>pair.every(p=>damageTaken(type,p)>1)));
 const offense=doubleOffense(pair,opponents,data),support=doubleSupport(pair,opponents,data);
 const healing=matrix.filter(row=>row.some(cell=>cell.threats.some(x=>x.abilityImmunity&&x.type==='water'))).length;
 const baseKey=[values[0],shared.filter(Boolean).length,...values.slice(1),-healing];
 const stats=pair.map(p=>quickStats(p,data));
 const bulk=stats.every(Boolean)?['hp','def','spd'].flatMap(k=>stats.map(s=>-s[k]).sort((a,b)=>b-a)):null;
 const hazards=pair.flatMap((p,i)=>p.moves.filter(m=>m[1]).map(m=>doubleMove(p,m,opponents,data)).map(m=>({move:m,impact:doubleAllyImpact(m,pair[1-i])})).filter(x=>x.impact));
 return {pair,matrix,values,shared,offense,support,baseKey,bulk,bulkFront:0,balancedFront:0,hazards,
  utility:[-Number(support.some(n=>n.kind==='intimidate')),-Number(support.some(n=>n.kind==='heal-ally')),-Number(support.some(n=>n.kind==='protect')),-Number(support.some(n=>n.kind==='pivot'))]};
}
function doubleRankRows(rows){
 const groups=new Map();rows.forEach(r=>{const key=JSON.stringify(r.baseKey);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)});
 groups.forEach(g=>{if(g.every(r=>r.bulk))doubleFronts(g,r=>r.bulk,'bulkFront')});
 rows.forEach(r=>r.defensiveKey=[...r.baseKey,r.bulkFront,...r.utility,...r.offense.key]);
 // Pareto-optimal compromises in defense and offense, not a weighted total.
 // Use the core criteria, so a conditional support move cannot fake safety.
 doubleFronts(rows,r=>[...r.baseKey,...r.offense.key],'balancedFront');
 rows.forEach(r=>r.balancedKey=[r.balancedFront,r.values.filter(n=>n>=3).length,r.values[0],r.shared.filter(Boolean).length,r.offense.coverage.filter(n=>n===0).length,...r.utility,...r.offense.key,...r.baseKey,r.bulkFront]);
 const keys={defensive:'defensiveKey',offensive:'offense',balanced:'balancedKey'};
 const rankings={};
 Object.entries(keys).forEach(([kind,key])=>{
  const vector=r=>key==='offense'?r.offense.key:r[key];
  rankings[kind]=rows.slice().sort((a,b)=>doubleCompare(vector(a),vector(b))).map((r,i,list)=>{
   const first=list.findIndex(x=>doubleCompare(vector(r),vector(x))===0),tied=list.filter(x=>doubleCompare(vector(r),vector(x))===0).length>1;
   return {...r,rank:first+1,tied};
  });
 });
 return rankings;
}
function doublePosition(rows,current,opponents){
 if(current.length!==2)return null;
 const currentNames=current.map(p=>p.name),existing=rows.find(r=>currentNames.every(n=>r.pair.some(p=>p.name===n)));
 if(!existing)return null;
 const sufficient=r=>r.values[0]<=1&&r.offense.coverage.every(n=>n>=1);
 const patterns={keep:[],swapSecond:[],swapFirst:[],swapBoth:[]};
 for(const row of rows){
  const [p,q]=row.pair;
  for(const slots of [[p,q],[q,p]]){
   // A currently active Pokémon cannot be sent to the other slot via an ordinary switch.
   if(slots[0].name===currentNames[1]||slots[1].name===currentNames[0])continue;
   const changed=slots.map((s,i)=>s.name!==currentNames[i]),count=changed.filter(Boolean).length;
   const pattern=!count?'keep':count===2?'swapBoth':changed[0]?'swapFirst':'swapSecond';
   patterns[pattern].push({row,slots,changed,count,pattern});
  }
 }
 const keep=patterns.keep[0];
 if(sufficient(existing))return {...keep,patterns,adequate:true,reason:'A dupla atual não recebe dano super efetivo dos tipos informados e pode responder aos dois adversários com golpes ao menos neutros. Manter preserva as duas ações; HP e cobertura ainda podem mudar a decisão.'};
 // Demand a meaningful reduction of the largest exposure, shared weaknesses,
 // or unanswerable targets; never switch merely to win a base-stat tie.
 const risk=r=>[r.values[0],r.shared.filter(Boolean).length,r.values.filter(n=>n>1).length,r.offense.coverage.filter(n=>n===0).length];
 const improves=r=>doubleCompare(risk(r),risk(existing))<0&&r.values[0]<=existing.values[0];
 const singles=[...patterns.swapFirst,...patterns.swapSecond].filter(x=>improves(x.row));
 singles.sort((a,b)=>doubleCompare(risk(a.row),risk(b.row))||doubleCompare(a.row.balancedKey,b.row.balancedKey));
 const adequateSingle=singles.find(x=>sufficient(x.row));
 if(adequateSingle)return {...adequateSingle,patterns,adequate:false,reason:'Uma troca reduz a exposição relevante e mantém a ação do parceiro. A entrada ainda pode receber ataques dos dois adversários.'};
 const doubles=patterns.swapBoth.filter(x=>improves(x.row));
 doubles.sort((a,b)=>doubleCompare(risk(a.row),risk(b.row))||doubleCompare(a.row.balancedKey,b.row.balancedKey));
 if(doubles[0]&&(!singles[0]||doubleCompare(risk(doubles[0].row),risk(singles[0].row))<0)&&sufficient(doubles[0].row))return {...doubles[0],patterns,adequate:false,reason:'Duas trocas resolvem uma exposição que uma só não resolveu. Custam as duas ações do turno e os dois entrantes podem ser atacados; não são trocas gratuitas.'};
 if(singles[0])return {...singles[0],patterns,adequate:false,reason:'Uma troca reduz a maior exposição conhecida e preserva a ação do parceiro, mas ainda restam riscos. Confira os quatro cruzamentos de tipos.'};
 if(doubles[0])return {...doubles[0],patterns,adequate:false,reason:'Só uma troca dupla melhora os riscos estruturais identificados. Consome ambas as ações e não garante sobreviver às entradas.'};
 return {...keep,patterns,adequate:false,reason:'Nenhuma troca disponível demonstrou redução relevante da exposição conhecida. Manter evita gastar ações apenas por um desempate; a posição ainda exige cuidado.'};
}
function doubleAnalyze(opponents,team,data,allySlots=['','']){
 const invalid={valid:false,all:[],rankings:{defensive:[],offensive:[],balanced:[]},position:null,warnings:[]};
 const typeSets=Array.isArray(opponents)?doubleTypeSets(opponents):[];
 if(typeSets.length!==2||typeSets.some(types=>!types.length||types.length>2||types.some(t=>!Object.hasOwn(TYPES,t))||new Set(types).size!==types.length))return {...invalid,error:'Selecione o tipo principal de cada adversário. O segundo tipo é opcional e deve ser diferente.'};
 if(!Array.isArray(allySlots)||allySlots.length!==2)return {...invalid,error:'São necessários dois slots aliados opcionais.'};
 const allies=allySlots.filter(Boolean);
 if(new Set(allies).size!==allies.length)return {...invalid,error:'Escolha Pokémon diferentes para os slots aliados.'};
 if(new Set(team.map(p=>p.name)).size!==team.length)return {...invalid,error:'Há integrantes duplicados nos dados da equipe.'};
 if(allies.some(n=>!team.some(p=>p.name===n)))return {...invalid,error:'Um aliado selecionado não pertence à equipe confirmada.'};
 const comparable=team.flatMap(p=>p.moves.filter(m=>m[1]).map(m=>doubleMove(p,m,opponents,data))).every(m=>m.known);
 const analysisData={...data,pressureComparable:comparable};
 const all=doublePairs(team).map(pair=>doubleEvaluate(pair,opponents,analysisData)),rankings=doubleRankRows(all);
 const eligible=allies.length===1?all.filter(r=>r.pair.some(p=>p.name===allies[0])):all;
 const eligibleRanks=allies.length===1?doubleRankRows(eligible.map(r=>({...r}))):rankings;
 const warnings=[];
 if(team.some(p=>!QUICK_KNOWN_ABILITIES.has(p.ability)))warnings.push('Há habilidade sem mecânica incorporada; nenhum efeito defensivo novo foi presumido.');
 const damageMoves=team.flatMap(p=>p.moves.filter(m=>m[1]).map(m=>doubleMove(p,m,opponents,data)));
 if(!damageMoves.every(m=>Number.isFinite(m.facts.power)&&(Number.isFinite(m.facts.accuracy)||m.facts.accuracyMode==='bypass')&&['physical','special'].includes(m.facts.category)))warnings.push('Poder, precisão e categoria ainda têm verificação parcial no Lazarus. Não foram usados para comparar dano, Ataque/SpA ou garantir eliminações.');
 if(team.some(p=>p.moves.some(m=>doubleFacts(m[0],data).target==='unknown')))warnings.push('Parting Shot: a documentação menciona os alvos afetados, mas não confirma o alcance em duplas. Nenhum bônus de área foi aplicado.');
 if(!team.every(p=>quickStats(p,data)))warnings.push('Há atributos base não verificados; eles não foram usados nos desempates afetados.');
 const position=allies.length===2?doublePosition(all,allySlots.map(n=>team.find(p=>p.name===n)),opponents):null;
 return {valid:true,opponents:typeSets.map(types=>types.slice()),all,rankings,recommendations:eligibleRanks,eligibleCount:eligible.length,pinned:allies.length===1?allies[0]:null,position,warnings};
}
function doubleDefenseText(r,opponents){return r.pair.map((p,i)=>`${p.name}: ${r.matrix[i].map((x,j)=>x.threats.map(t=>`${String.fromCharCode(65+j)} ${TYPES[t.type]} ${quickFactor(t.multiplier)}${t.abilityImmunity?' por Water Absorb':t.multiplier===0?' por tipagem':t.solidRock?' com Solid Rock':''}`).join(' · ')).join(' · ')}`).join('; ')+'.'}
function doubleOffenseText(r){return r.offense.actions.map(a=>a.name?`${a.owner} → ${a.targets.map(i=>String.fromCharCode(65+i)).join(' e ')}: ${a.name} ${a.targets.map(i=>quickFactor(a.coverage[i])).join('/')} ${a.stab?'com STAB ':''}· poder base ${a.facts.power} · ${a.facts.category==='special'?'especial':'físico'} · precisão ${a.facts.accuracy}${a.precision==='bypass'?' (não testa precisão)':''}${a.priority&&!a.conditional?' · prioridade +'+(a.facts.priority||1):''} ${a.conditional?'· condicional ':''}`:`${a.owner}: sem ataque sustentado confirmado`).join('; ')+'.'}
function doublePairReason(r,opponents,kind){
 const sets=doubleTypeSets(opponents);
 const shared=r.shared.flatMap((yes,i)=>yes?[`${String.fromCharCode(65+i)} (${sets[i].map(t=>TYPES[t]).join('/')}) ameaça os dois aliados super efetivamente.`]:[]);
 const complement=sets.flatMap((types,i)=>types.flatMap(t=>r.matrix[0][i].threats.find(x=>x.type===t).multiplier>1&&r.matrix[1][i].threats.find(x=>x.type===t).multiplier<1?[`${r.pair[1].name} resiste a ${TYPES[t]}, que ameaça ${r.pair[0].name}; isso não redireciona ataques.`]:r.matrix[1][i].threats.find(x=>x.type===t).multiplier>1&&r.matrix[0][i].threats.find(x=>x.type===t).multiplier<1?[`${r.pair[0].name} resiste a ${TYPES[t]}, que ameaça ${r.pair[1].name}; isso não redireciona ataques.`]:[]));
 return (kind==='offensive'?[doubleOffenseText(r),doubleDefenseText(r,opponents)]:[doubleDefenseText(r,opponents),doubleOffenseText(r)]).concat(shared,kind==='balanced'?complement:[]).join(' ');
}
if(typeof module!=='undefined')module.exports={doublePairs,doubleMove,doubleAllyImpact,doubleActions,doubleOffense,doubleEvaluate,doubleRankRows,doublePosition,doubleAnalyze,doublePairReason};

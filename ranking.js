'use strict';
// Ordered, explainable criteria. No weighted score and no predicted damage.
// Base stats are reference data, not the individual's current stats.
const QUICK_CONDITIONAL = new Set(['Fake Out','First Impression','Sucker Punch','Thunderclap','Upper Hand','Bide']);
const QUICK_SETUP = new Set(['Swords Dance']);
const QUICK_KNOWN_ABILITIES = new Set(['Water Absorb','Solid Rock','Intimidate','No Guard','Hyper Cutter','Shell Armor','Synchronize']);
function quickCompareKeys(a,b){for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]-b[i]}return 0}
function quickStats(p,data){const s=data.species?.[p.name];return s&&['hp','def','spd','spe'].every(k=>Number.isFinite(s[k]))?s:null}
function quickAttacks(p,types,data){
 const candidates=p.moves.filter(m=>m[1]).map(([name,type])=>({name,type,multiplier:effectiveness(type,types),stab:p.types.includes(type),priority:(data.highPriority||[]).includes(name),conditional:QUICK_CONDITIONAL.has(name),facts:data.confirmedMoveFacts?.[name]||{}}));
 const sustained=candidates.filter(m=>!m.conditional);
 const pool=sustained.length?sustained:candidates;
 pool.sort((a,b)=>quickCompareKeys([-a.multiplier,-Number(a.stab),-Number(a.priority)],[-b.multiplier,-Number(b.stab),-Number(b.priority)]));
 return {best:pool[0]||null,conditional:candidates.filter(m=>m.conditional),priority:candidates.filter(m=>m.priority&&!m.conditional&&m.multiplier>0)};
}
function quickBulkLayers(rows){
 // Pareto fronts: a Pokémon only wins this criterion if its HP, Def and SpD
 // are all at least as high, and at least one is higher. Incomparable = same tier.
 const groups=new Map();
 rows.forEach(r=>{r.bulkLayer=0;const key=JSON.stringify(r.defenseKey);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)});
 groups.forEach(group=>{
  if(!group.every(r=>r.stats))return;
  let remaining=group.slice(),layer=0;
  while(remaining.length){const front=remaining.filter(a=>!remaining.some(b=>a!==b&&['hp','def','spd'].every(k=>b.stats[k]>=a.stats[k])&&['hp','def','spd'].some(k=>b.stats[k]>a.stats[k])));front.forEach(r=>r.bulkLayer=layer);remaining=remaining.filter(r=>!front.includes(r));layer++}
 });
}
function quickRanking(types,team,data){
 if(!Array.isArray(types)||types.length<1||types.length>2||new Set(types).size!==types.length||types.some(t=>!Object.hasOwn(TYPES,t)))return {direct:[],free:[],warnings:[]};
 const hasSpeed=team.every(p=>quickStats(p,data));
 const rows=team.map(p=>{
  const stats=quickStats(p,data),attacks=quickAttacks(p,types,data),received=types.map(t=>({type:t,multiplier:damageTaken(t,p)}));
  const values=received.map(x=>x.multiplier).sort((a,b)=>b-a);
  const heals=types.includes('water')&&p.ability==='Water Absorb';
  const best=attacks.best;
  // Main immediate attack first; never assume a setup boost or a conditional bonus.
  const freeKey=[-(best?.multiplier||0),-Number(best?.stab||false),-Number(best?.priority&&!best?.conditional),-(hasSpeed?stats.spe:0),-Number(p.moves.some(m=>QUICK_SETUP.has(m[0]))),-Number(p.moves.some(m=>m[0]==='Parting Shot'))];
  return {pokemon:p,stats,attacks,received,heals,freeKey,defenseKey:[values[0],values[1]??values[0],-Number(heals)]};
 });
 quickBulkLayers(rows);
 rows.forEach(r=>r.directKey=[...r.defenseKey,r.bulkLayer,-Number(r.pokemon.ability==='Intimidate'),-Number(r.pokemon.moves.some(m=>m[0]==='Parting Shot')),...r.freeKey]);
 function sorted(key){const list=rows.slice().sort((a,b)=>quickCompareKeys(a[key],b[key]));list.forEach((r,i)=>{const tied=list.filter(x=>quickCompareKeys(r[key],x[key])===0);r[key+'Rank']=i&&quickCompareKeys(r[key],list[i-1][key])===0?list[i-1][key+'Rank']:i+1;r[key+'Tied']=tied.length>1});return list}
 const warnings=[];
 if(!team.every(p=>quickStats(p,data)))warnings.push('Há atributos de espécie ainda não verificados; esses dados não desempataram as opções.');
 if(team.some(p=>p.ability&&!QUICK_KNOWN_ABILITIES.has(p.ability)))warnings.push('Há habilidade nova cujo efeito ainda não foi incorporado ao modo rápido.');
 if(team.some(p=>!p.ability))warnings.push('A habilidade de '+team.filter(p=>!p.ability).map(p=>p.name).join(', ')+' ainda não foi registrada.');
 if(team.some(p=>p.moves.some(m=>m[1]&&QUICK_CONDITIONAL.has(m[0]))))warnings.push('Golpes condicionais não recebem bônus presumido. Fake Out vale apenas no primeiro turno após entrar.');
 return {direct:sorted('directKey'),free:sorted('freeKey'),warnings};
}
function quickFactor(n){return ({0:'0×',.25:'¼×',.5:'½×',1:'1×',1.5:'1,5×',2:'2×',3:'3×',4:'4×'})[n]??`${n}×`}
function quickAttackReason(r){const a=r.attacks.best;if(!a)return 'Sem golpe de dano confirmado.';if(a.multiplier===0)return 'Todos os golpes de dano confirmados são anulados por essa tipagem.';return `${a.name}: ${quickFactor(a.multiplier)}${a.stab?' com STAB':''}${a.priority&&!a.conditional?` e prioridade${Number.isFinite(a.facts?.priority)?' +'+a.facts.priority:''}`:''}${a.conditional?' (condicional)':''}.`}
function quickReason(r,scenario){
 const p=r.pokemon,parts=[];
 if(scenario==='direct'){
  parts.push(r.received.map(x=>`${TYPES[x.type]} ${quickFactor(x.multiplier)}`).join(' · ')+'.');
  if(r.heals)parts.push('Water Absorb anula Água e recupera ¼ do HP máximo.');
  if(p.ability==='Solid Rock'&&r.received.some(x=>x.multiplier>1))parts.push('Solid Rock já aplicado ao dano super efetivo.');
  if(r.stats)parts.push(`Bases HP/Def/SpD: ${r.stats.hp}/${r.stats.def}/${r.stats.spd}.`);
  if(p.ability==='Intimidate')parts.push('Intimidate reduz o Ataque ao entrar; não protege contra golpes especiais.');
  parts.push(quickAttackReason(r));
 }else{
  parts.push(quickAttackReason(r));
  if(r.stats)parts.push(`Velocidade base ${r.stats.spe}; ordem real não garantida.`);
  const priority=r.attacks.priority.filter(a=>a.name!==r.attacks.best?.name);
  if(priority.length)parts.push('Prioridade alternativa: '+priority.map(a=>`${a.name} ${quickFactor(a.multiplier)}`).join(', ')+'.');
  if(p.moves.some(m=>m[0]==='Swords Dance'))parts.push('Swords Dance exige outro turno; nenhum boost foi presumido.');
 }
 const fact=r.attacks.best?.facts;if(fact?.category==='physical')parts.push(`Golpe físico${Number.isFinite(fact.power)?' · poder base '+fact.power:''}.`);
 if(p.moves.some(m=>m[0]==='Acrobatics'))parts.push('Acrobatics dobra de poder apenas sem item; bônus não presumido.');
 if(p.moves.some(m=>m[0]==='Parting Shot'))parts.push('Parting Shot permite recuar reduzindo a pressão adversária.');
 if(p.moves.some(m=>m[0]==='Fury Cutter')&&r.attacks.best?.name==='Fury Cutter')parts.push('Sem acúmulo presumido de Fury Cutter.');
 if(p.moves.some(m=>m[0]==='Knock Off')&&r.attacks.best?.name==='Knock Off')parts.push('Sem bônus de item adversário presumido.');
 if(p.moves.some(m=>m[0]==='Pursuit')&&r.attacks.best?.name==='Pursuit')parts.push('Sem bônus de troca adversária presumido.');
 return parts.join(' ');
}
function positionAttackText(row){
 const a=row.attacks.best;if(!a)return 'sem golpe de dano confirmado';
 const detail=[a.facts?.category==='physical'?'físico':a.facts?.category==='special'?'especial':null,Number.isFinite(a.facts?.power)?`poder ${a.facts.power}`:null].filter(Boolean).join(', ');
 return `${a.name} ${quickFactor(a.multiplier)}${a.stab?' com STAB':''}${detail?` (${detail})`:''}${a.priority?' · prioridade':''}${a.conditional?' · condicional':''}`;
}
function staySwitchAdvice(types,currentName,team,data){
 if(!currentName||!Array.isArray(types)||!types.length||types.length>2)return null;
 const ranking=quickRanking(types,team,data),current=ranking.direct.find(r=>r.pokemon.name===currentName);
 if(!current)return null;
 const alternatives=ranking.direct.filter(r=>r.pokemon.name!==currentName),alternative=alternatives[0]||null;
 const riskOf=row=>Math.max(...row.received.map(x=>x.multiplier));
 const currentRisk=riskOf(current),alternativeRisk=alternative?riskOf(alternative):null;
 const attack=current.attacks.best,pressure=!!attack&&attack.multiplier>1&&!attack.conditional;
 const significantGain=alternative&&(currentRisk>=2&&alternativeRisk<=.5||currentRisk>=4&&alternativeRisk<=1);
 let decision,reason;
 const label=types.map(t=>TYPES[t]).join(' / '),currentFactor=quickFactor(currentRisk);
 if(currentRisk===0){
  decision='PERMANECER';reason=`${current.pokemon.name} já anula ${label}${current.heals?' com Water Absorb':''}; a troca não melhora a defesa contra o tipo informado.`;
 }else if(currentRisk<=1&&pressure){
  decision='PERMANECER';reason=`${current.pokemon.name} recebe ${currentFactor} de ${label} e responde com ${positionAttackText(current)}. A troca não oferece melhora suficiente para abrir mão da ação.`;
 }else if(significantGain&&pressure){
  decision='SITUACIONAL';reason=`${current.pokemon.name} recebe ${currentFactor} de ${label}, mas ameaça com ${positionAttackText(current)}. ${alternative.pokemon.name} reduz o risco para ${quickFactor(alternativeRisk)}; a escolha depende do HP e dos golpes adversários.`;
 }else if(significantGain){
  decision='TROCAR';reason=`${current.pokemon.name} recebe ${currentFactor} de ${label} e não tem resposta super efetiva confirmada. ${alternative.pokemon.name} reduz o dano previsto por tipos para ${quickFactor(alternativeRisk)}${alternative.heals?' e anula Água com Water Absorb':''}; a troca consome a ação deste turno.`;
 }else if(currentRisk<=.5&&attack&&attack.multiplier>=1){
  decision='PERMANECER';reason=`${current.pokemon.name} já resiste a ${label} (${currentFactor}) e pode responder com ${positionAttackText(current)}. Nenhuma alternativa melhora a defesa o bastante para exigir a troca.`;
 }else{
  decision='SITUACIONAL';
  if(alternative&&alternativeRisk<currentRisk)reason=`${current.pokemon.name} recebe ${currentFactor} de ${label}${attack?` e responde com ${positionAttackText(current)}`:' sem golpe de dano confirmado'}; ${alternative.pokemon.name} reduziria para ${quickFactor(alternativeRisk)}, mas o ganho defensivo e a perda da ação não bastam para recomendar a troca com segurança.`;
  else reason=`${current.pokemon.name} recebe ${currentFactor} de ${label}${attack?` e responde com ${positionAttackText(current)}`:' sem golpe de dano confirmado'}; nenhuma alternativa melhora claramente a defesa. HP, velocidade e golpes adversários podem mudar a decisão.`;
 }
 const statText=row=>row.stats?`Bases HP/Def/Def. Esp./Vel.: ${row.stats.hp}/${row.stats.def}/${row.stats.spd}/${row.stats.spe}.`:'Bases do Pokémon não verificadas.';
 const currentNotes=[];
 if(current.pokemon.moves.some(([name])=>{const f=data.confirmedMoveFacts?.[name];return Number.isFinite(f?.specialAttackStages)||Number.isFinite(f?.attackStages)}))currentNotes.push('Setup disponível; nenhum boost foi presumido.');
 const recovery=current.pokemon.moves.filter(([name])=>Number.isFinite(data.confirmedMoveFacts?.[name]?.drainFraction));
 if(recovery.length)currentNotes.push(`${recovery.map(([name])=>name).join(', ')} pode recuperar HP conforme o dano causado.`);
 return {decision,reason,current,alternative,currentRisk,alternativeRisk,details:[statText(current),`Resposta imediata: ${positionAttackText(current)}.`,...currentNotes,alternative?`${alternative.pokemon.name}: recebe ${quickFactor(alternativeRisk)}; ${quickAttackReason(alternative)} ${statText(alternative)}`:'Não há outra opção disponível no sexteto.','Bases são referências, não atributos atuais. Trocar consome a ação; HP, boosts e movimentos adversários são desconhecidos.'].join(' ')};
}
if(typeof module!=='undefined')module.exports={quickRanking,quickAttacks,quickReason,quickCompareKeys,quickBulkLayers,staySwitchAdvice};

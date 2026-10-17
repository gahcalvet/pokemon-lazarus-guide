'use strict';
// Ordered, explainable criteria. No weighted score and no predicted damage.
// Base stats are reference data, not the individual's current stats.
const QUICK_CONDITIONAL = new Set(['Fake Out','First Impression','Sucker Punch','Thunderclap','Upper Hand','Bide']);
const QUICK_SETUP = new Set(['Swords Dance']);
const QUICK_KNOWN_ABILITIES = new Set(['Water Absorb','Volt Absorb','Solid Rock','Intimidate','No Guard','Hyper Cutter','Shell Armor','Synchronize','Gluttony','Blaze','Overgrow','Trace','Static']);
function quickCompareKeys(a,b){for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]-b[i]}return 0}
function quickStats(p,data){const s=data.species?.[p.name];return s&&['hp','def','spd','spe'].every(k=>Number.isFinite(s[k]))?s:null}
function quickAttacks(p,types,data){
 const candidates=p.moves.filter(m=>m[1]).map(([name,type])=>({name,type,multiplier:effectiveness(type,types),stab:p.types.includes(type),priority:Number.isFinite(data.confirmedMoveFacts?.[name]?.priority)?data.confirmedMoveFacts[name].priority>0:(data.highPriority||[]).includes(name),conditional:QUICK_CONDITIONAL.has(name),facts:data.confirmedMoveFacts?.[name]||{}})).filter(m=>m.facts.category!=='status');
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
  const heals=(types.includes('water')&&p.ability==='Water Absorb')||(types.includes('electric')&&p.ability==='Volt Absorb');
  const best=attacks.best;
  // Main immediate attack first; never assume a setup boost or a conditional bonus.
  const setupMoves=data.game==='Pokémon Dreamstone Mysteries'?new Set([...QUICK_SETUP,'Charge']):QUICK_SETUP;
  const freeKey=[-(best?.multiplier||0),-Number(best?.stab||false),-Number(best?.priority&&!best?.conditional),-(hasSpeed?stats.spe:0),-Number(p.moves.some(m=>setupMoves.has(m[0]))),-Number(p.moves.some(m=>m[0]==='Parting Shot'))];
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
  if(r.heals)parts.push(p.ability==='Water Absorb'?'Water Absorb anula Água e recupera ¼ do HP máximo.':'Volt Absorb anula Elétrico e recupera ¼ do HP máximo.');
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
 const alternatives=ranking.direct.filter(r=>r.pokemon.name!==currentName);
 const riskOf=row=>Math.max(...row.received.map(x=>x.multiplier));
 const currentRisk=riskOf(current),alternative=alternatives.slice().sort((a,b)=>riskOf(a)-riskOf(b))[0]||null;
 const alternativeRisk=alternative?riskOf(alternative):null;
 const attack=current.attacks.best;
 let decision,reason;
 const label=types.map(t=>TYPES[t]).join(' / '),currentFactor=quickFactor(currentRisk);
 if(currentRisk===0){
  decision='IMUNIDADE POR TIPO';reason=`${current.pokemon.name} é imune a ${label}${current.heals?' e '+current.pokemon.ability+' recupera HP':''}. Isso descreve apenas o tipo do golpe; habilidade, cobertura e situação da batalha não foram informadas.`;
 }else if(alternative&&alternativeRisk<currentRisk){
  decision=currentRisk>1?'AVALIAR TROCA':'ALTERNATIVA MAIS RESISTENTE';
  reason=`${current.pokemon.name} recebe ${currentFactor} de ${label}${attack?` e tem ${positionAttackText(current)}`:' e não tem golpe de dano confirmado'}; ${alternative.pokemon.name} recebe ${quickFactor(alternativeRisk)} por tipo${alternative.heals?' e anula o tipo com '+alternative.pokemon.ability:''}. O golpe favorável não garante agir primeiro ou nocautear; trocar também consome a ação.`;
 }else if(currentRisk>1){
  decision='AMEAÇA POR TIPO';reason=`${current.pokemon.name} recebe ${currentFactor} de ${label}${attack?` e tem ${positionAttackText(current)}`:' sem golpe de dano confirmado'}; nenhuma alternativa da equipe reduz essa exposição. HP, velocidade, cobertura e golpe adversário podem mudar a decisão.`;
 }else if(currentRisk<=.5&&attack&&attack.multiplier>1&&!attack.conditional){
  decision='VANTAGEM DE TIPO';reason=`${current.pokemon.name} resiste a ${label} (${currentFactor}) e tem ${positionAttackText(current)}. São vantagens de tipo e golpe; sem HP, velocidade e golpe adversário não dá para concluir que ficar é a melhor jogada.`;
 }else{
  decision='SEM VANTAGEM CLARA';reason=`${current.pokemon.name} recebe ${currentFactor} de ${label}${attack?` e tem ${positionAttackText(current)}`:' sem golpe de dano confirmado'}; nenhuma alternativa reduz a exposição por tipo. HP, velocidade, cobertura e golpe adversário podem mudar a decisão.`;
 }
 const statText=row=>row.stats?`Bases HP/Def/Def. Esp./Vel.: ${row.stats.hp}/${row.stats.def}/${row.stats.spd}/${row.stats.spe}.`:'Bases do Pokémon não verificadas.';
 const currentNotes=[];
 if(current.pokemon.moves.some(([name])=>{const f=data.confirmedMoveFacts?.[name];return Number.isFinite(f?.specialAttackStages)||Number.isFinite(f?.attackStages)}))currentNotes.push('Setup disponível; nenhum boost foi presumido.');
 const recovery=current.pokemon.moves.filter(([name])=>Number.isFinite(data.confirmedMoveFacts?.[name]?.drainFraction));
 if(recovery.length)currentNotes.push(`${recovery.map(([name])=>name).join(', ')} pode recuperar HP conforme o dano causado.`);
 return {decision,reason,current,alternative,currentRisk,alternativeRisk,details:[statText(current),`Resposta imediata: ${positionAttackText(current)}.`,...currentNotes,alternative?`${alternative.pokemon.name}: recebe ${quickFactor(alternativeRisk)}; ${quickAttackReason(alternative)} ${statText(alternative)}`:'Não há outra opção disponível no sexteto.','Bases são referências, não atributos atuais. Trocar consome a ação; HP, boosts e movimentos adversários são desconhecidos.'].join(' ')};
}
function individualActionRanking(types,currentName,team,data,fakeOutAvailable=null){
 if(data.game==='Pokémon Dreamstone Mysteries')return dreamstoneIndividualActionRanking(types,currentName,team,data);
 if(!currentName||!Array.isArray(types)||!types.length||types.length>2)return {actions:[],fakeOutRelevant:false};
 const current=team.find(p=>p.name===currentName);if(!current)return {actions:[],fakeOutRelevant:false};
 const currentRisk=Math.max(...types.map(t=>damageTaken(t,current)));
 const ghost=types.includes('ghost');
 const attacks=current.moves.filter(([name,type])=>type&&!(name==='Fake Out'&&(ghost||fakeOutAvailable!==true))).map(([name,type])=>{
  const facts=data.confirmedMoveFacts?.[name]||{},multiplier=effectiveness(type,types),stab=current.types.includes(type),priority=Number.isFinite(facts.priority)?facts.priority:((data.highPriority||[]).includes(name)?1:0);
  return {kind:'stay',action:name,target:'Adversário',key:`stay:${name}`,reason:`${quickFactor(multiplier)} de efetividade${stab?' com STAB':''}${Number.isFinite(facts.power)?`; poder base ${facts.power}`:''}${priority?`; prioridade +${priority}`:''}.`,risk:currentRisk,score:[multiplier*(Number.isFinite(facts.power)?facts.power:40)*(stab?1.5:1),priority,-(facts.accuracyMode==='check'&&Number.isFinite(facts.accuracy)?100-facts.accuracy:0)],uncertainty:[name==='Fake Out'?'Só funciona no primeiro turno após entrar; flinch não é garantido.':null,name==='Knock Off'?'Bônus depende de item removível; item adversário desconhecido.':null,name==='Acrobatics'?'Bônus depende de Gligar estar sem item; item não confirmado.':null,name==='Pursuit'?'Bônus depende de o adversário tentar trocar.':null].filter(Boolean).join(' ')};
 });
 const actions=attacks.map(a=>({...a,type:'ATACAR'}));
 const parting=current.moves.some(([n])=>n==='Parting Shot');
 if(parting)actions.push({kind:'pivot',type:'REPOSICIONAR',action:'Parting Shot',target:'Adversário',key:'pivot:Parting Shot',reason:'Reduz Ataque e Ataque Especial do alvo e permite reposicionar se funcionar.',risk:currentRisk,score:[currentRisk>1?72:36,0,0],uncertainty:'Torracat pode receber um golpe antes; efeito e reposicionamento não são garantidos.'});
 const setup=current.moves.find(([n])=>n==='Calm Mind');
 if(setup)actions.push({kind:'setup',type:'PREPARAR',action:'Calm Mind',target:'Próprio Kirlia',key:'setup:Calm Mind',reason:'Aumenta Ataque Especial e Defesa Especial em 1 estágio.',risk:currentRisk,score:[currentRisk<=.5?68:currentRisk<=1?42:8,0,0],uncertainty:currentRisk>1?'Ameaça imediata por tipo; HP, velocidade e golpe adversário desconhecidos. Setup consome a ação.':'Consome a ação; nenhum boost é presumido neste turno.'});
 const swaps=team.filter(p=>p.name!==currentName).map(p=>({p,risk:Math.max(...types.map(t=>damageTaken(t,p)))})).filter(x=>x.risk<currentRisk).sort((a,b)=>a.risk-b.risk);
 for(const x of swaps.slice(0,2))actions.push({kind:'switch',type:'TROCAR',action:`Trocar ${currentName} por ${x.p.name}`,target:'Troca convencional',key:`switch:${x.p.name}`,reason:`Exposição por tipo cai de ${quickFactor(currentRisk)} para ${quickFactor(x.risk)}.`,risk:x.risk,score:[x.risk<=.5?64:x.risk<=1?50:24,0,0],uncertainty:'A troca consome a ação do turno; '+x.p.name+' entra sem atacar neste turno.'});
 const unique=actions.filter((a,i)=>actions.findIndex(x=>x.key===a.key)===i);
 const attackActions=unique.filter(a=>a.kind==='stay').sort((a,b)=>quickCompareKeys(b.score,a.score));
 const switches=unique.filter(a=>a.kind==='switch').sort((a,b)=>a.risk-b.risk);
 const tactical=unique.filter(a=>a.kind!=='stay'&&a.kind!=='switch');
 // Keep unlike actions in separate groups; base-power points and switch scores
 // are not comparable, and the available facts cannot identify one best turn.
 let recommended=[], recommendationReason='';
 const safest=switches[0],bestAttack=attackActions[0];
 if(safest&&((currentRisk>1&&safest.risk<currentRisk)||(currentRisk>=1&&safest.risk===0))){
  recommended=switches.filter(a=>a.risk===safest.risk);recommendationReason=`Reduz a exposição por tipo de ${quickFactor(currentRisk)} para ${quickFactor(safest.risk)}. A troca perde a ação e não considera cobertura adversária.`;
 }else if(bestAttack&&bestAttack.score[0]>0){
  recommended=attackActions.filter(a=>quickCompareKeys(a.score,bestAttack.score)===0);recommendationReason='Melhor pressão ofensiva confirmada por tipo, STAB e poder-base. Não prevê dano, nocaute nem ordem de ação.';
 }else if(tactical.length){
  recommended=[tactical[0]];recommendationReason='Opção tática disponível; seu valor depende de HP, velocidade e resposta adversária.';
 }else if(safest){
  recommended=switches.filter(a=>a.risk===safest.risk);recommendationReason=`Reduz a exposição por tipo (${quickFactor(currentRisk)} → ${quickFactor(safest.risk)}), mas o ganho talvez não compense perder a ação.`;
 }else if(bestAttack){
  recommended=attackActions.filter(a=>quickCompareKeys(a.score,bestAttack.score)===0);recommendationReason=bestAttack.score[0]===0?'Nenhum golpe confirmado afeta esse tipo; esta é a opção ofensiva mais bem ranqueada entre as disponíveis.':'Entre as opções disponíveis, este golpe tem a melhor combinação confirmada de efetividade, STAB e poder-base.';
 }
 return {actions:[...attackActions,...switches,...tactical],recommended,recommendationReason,fakeOutRelevant:current.name==='Torracat'&&!ghost&&current.moves.some(([n])=>n==='Fake Out')};
}
function dreamstoneGyaradosFormAdvice(types,data,team=[]){
 const forms=data.megaForms?.Gyarados;if(!forms)return '';
 const normal={types:forms.normal.types,ability:forms.normal.ability},mega={types:forms.mega.types,ability:forms.mega.ability};
 const normalRisk=Math.max(...types.map(t=>damageTaken(t,normal))),megaRisk=Math.max(...types.map(t=>damageTaken(t,mega)),0),label=types.map(t=>TYPES[t]).join(' / ');\n const safer=team.filter(p=>p.name!=='Gyarados').map(p=>({name:p.name,risk:Math.max(...types.map(t=>damageTaken(t,p)))})).filter(p=>p.risk<normalRisk).sort((a,b)=>a.risk-b.risk);
 const risk=normalRisk>megaRisk?'Pelos tipos selecionados, maior exposição cai de '+quickFactor(normalRisk)+' para '+quickFactor(megaRisk)+'.':megaRisk>normalRisk?'Pelos tipos selecionados, maior exposição sobe de '+quickFactor(normalRisk)+' para '+quickFactor(megaRisk)+'.':'Pelos tipos selecionados, a maior exposição fica igual ('+quickFactor(normalRisk)+').';
 let decision;
 if(types.includes('ground'))decision='MANTER NORMAL POR ENQUANTO: Gyarados normal é imune a Terra pelo tipo Voador; Mega Gyarados perde essa imunidade.';
 else if(megaRisk<normalRisk)decision='MEGA FAVORECIDA PELOS TIPOS SELECIONADOS: a forma Água/Sombrio reduz a maior exposição considerada.';
 else if(megaRisk===normalRisk&&effectiveness('dark',types)>1)decision='MEGA FAVORECIDA OFENSIVAMENTE: Crunch passa a ter STAB e é super efetivo contra o tipo selecionado, além do Ataque base maior.';
 else if(megaRisk>normalRisk)decision='MANTER A FORMA NORMAL PELOS TIPOS SELECIONADOS: a Mega aumenta a maior exposição considerada.';
 else decision='SEM VANTAGEM DEFENSIVA CLARA: a decisão depende da pressão ofensiva e do valor de Intimidate.';
 return {decision,text:'Mega Gyarados — '+decision+' '+risk+' '+(label?'Comparação apenas contra tipos selecionados ('+label+'); isso não confirma quais golpes o adversário conhece ou usará. ':'')+(safer.length?' Outras entradas com menor exposição por tipo: '+safer.map(p=>p.name+' '+quickFactor(p.risk)).join(', ')+'. Trocar consome a ação e cobertura adversária é desconhecida.':'')+' A Mega ganha +30 Ataque, +30 Defesa, +10 Ataque Especial e +30 Defesa Especial; Velocidade e HP base não mudam. Água/Sombrio dá STAB a Crunch; Mold Breaker substitui Intimidate e pode ignorar certas habilidades adversárias, se relevantes. A forma normal mantém Intimidate e imunidade a Terra. Gyaradosite está confirmada e registrada como item segurado no lugar de Life Orb. Bases são da ROM; não se estima dano, KO, ação adversária ou valor de Intimidate sem dados físicos/especiais.'};
}
function dreamstoneIndividualActionRanking(types,currentName,team,data){
 if(!currentName||!Array.isArray(types)||!types.length||types.length>2)return {actions:[],recommended:[],fakeOutRelevant:false};
 const current=team.find(p=>p.name===currentName);if(!current)return {actions:[],recommended:[],fakeOutRelevant:false};
 const currentRisk=Math.max(...types.map(t=>damageTaken(t,current)));
 const megaAdvice=current.name==='Gyarados'?dreamstoneGyaradosFormAdvice(types,data,team):'';
 const attacks=current.moves.map(([name,type])=>({name,type,facts:data.confirmedMoveFacts?.[name]||{}})).filter(m=>m.type&&['physical','special'].includes(m.facts.category)).map(m=>{
  const multiplier=effectiveness(m.type,types),stab=current.types.includes(m.type),priority=m.facts.priority||0,accuracy=m.facts.accuracy;
  const effects=[m.facts.criticalHitStage?'alta chance de crítico':null,m.facts.effectChance||null].filter(Boolean).join('; ');
  return {kind:'stay',type:'ATACAR',action:m.name,target:'Adversário',key:`stay:${m.name}`,reason:`${quickFactor(multiplier)}${stab?' com STAB':''}; poder-base ${m.facts.power}${m.facts.accuracyMode==='bypass'?' · não testa precisão':Number.isFinite(accuracy)?` · precisão ${accuracy}%`:''}${priority?` · prioridade +${priority}`:''}${effects?` · ${effects}`:''}.`,risk:currentRisk,multiplier,score:[multiplier*m.facts.power*(stab?1.5:1),priority,m.facts.accuracyMode==='bypass'||current.ability==='No Guard'?100:Number.isFinite(accuracy)?accuracy:0],uncertainty:''};
 }).sort((a,b)=>quickCompareKeys(b.score,a.score));
 const tactical=current.moves.map(([name])=>({name,facts:data.confirmedMoveFacts?.[name]||{}})).filter(m=>m.facts.category==='status').map(({name,facts})=>{
  const role=facts.role||'status',kind=role==='pivot'?'pivot':role==='setup'?'setup':role==='heal-self'?'heal':role==='seed'?'support':role==='debuff'?'support':'support';
  const uncertainty=role==='heal-self'?'Valor depende do HP faltante e do clima; não foram informados.':role==='setup'?'Consome a ação; depende de sobreviver e agir antes de receber novo dano.':role==='pivot'?'Prioridade -6: o usuário pode ser atingido antes de sair; a troca também consome sua ação.':role==='seed'?'Depende de acertar e o alvo não ser imune; recuperação ocorre ao fim de turnos.':name==='Rain Dance'?'Útil se Gyarados puder aproveitar depois Waterfall ou se a chuva favorecer o plano; consome a ação e o clima dura cinco turnos.':name==='Toxic'?'Pode pressionar alvos resistentes a dano direto em turnos seguintes; falha contra algumas imunidades e não causa dano imediato.':name==='Hypnosis'?'Pode negar ações se acertar (60%); sono, imunidades e condição do alvo não foram confirmados.':name==='Thunder Wave'?'Pode reduzir a velocidade efetiva do alvo se acertar (90%); falha contra Terra e outras imunidades/condições.':name==='Charge'?'Pode preparar Discharge para o próximo turno e elevar a Defesa Especial; consome uma ação e não causa dano agora.':'Depende da precisão e da condição/imunidade do alvo, que são desconhecidas.';
  const value=name==='Synthesis'? (currentRisk>1?3:2):name==='Leech Seed'||name==='Toxic'?2:name==='Hypnosis'||name==='Thunder Wave'?2:name==='Charge'&&current.moves.some(([n])=>n==='Discharge')?2:name==='Rain Dance'&&current.moves.some(([n])=>n==='Waterfall')?2:1;
  return {kind,type:role==='pivot'?'REPOSICIONAR':role==='setup'?'PREPARAR':role==='heal-self'?'RECUPERAR':'SUPORTE',action:name,target:facts.target==='self'?'Próprio Pokémon':facts.target==='field'?'Campo': 'Adversário',key:`${kind}:${name}`,reason:facts.effect||'Efeito de suporte confirmado.',risk:currentRisk,score:[value,0,0],uncertainty};
 }).sort((a,b)=>quickCompareKeys(b.score,a.score));
 const switches=team.filter(p=>p.name!==currentName).map(p=>({p,risk:Math.max(...types.map(t=>damageTaken(t,p)))})).filter(x=>x.risk<currentRisk).sort((a,b)=>a.risk-b.risk).slice(0,2).map(x=>({kind:'switch',type:'TROCAR',action:`Trocar ${currentName} por ${x.p.name}`,target:'Troca convencional',key:`switch:${x.p.name}`,reason:`Exposição por tipo cai de ${quickFactor(currentRisk)} para ${quickFactor(x.risk)}.`,risk:x.risk,score:[0,0,0],uncertainty:'A troca consome a ação; o entrante não ataca neste turno e ainda pode receber golpes.'}));
 const attackActions=attacks.map(a=>({...a,uncertainty:a.uncertainty||'Não estima dano, KO ou velocidade real.'}));
 const recommended=[];let recommendationReason='';
 if(currentRisk>1&&switches.length){recommended.push(switches[0]);recommendationReason=`A troca indicada reduz a maior exposição por tipo de ${quickFactor(currentRisk)} para ${quickFactor(switches[0].risk)}; ainda custa a ação e não inclui cobertura adversária.`;}
 if(attackActions.length){const best=attackActions[0];if(best.score[0]>0){recommended.push(...attackActions.slice(0,Math.min(2,3-recommended.length)));if(!recommendationReason)recommendationReason='Ataques ordenados por efetividade × poder-base × STAB, depois prioridade e precisão. As opções abaixo são alternativas de turno.';else recommendationReason+=' Como alternativa ficando em campo, ataques são ordenados por efetividade, STAB, poder-base, prioridade e precisão.';}}
 if(tactical.length&&recommended.length<3){const options=tactical.filter(a=>!recommended.some(r=>r.key===a.key)).slice(0,3-recommended.length);recommended.push(...options);if(options.length)recommendationReason+=(recommendationReason?' ':'')+'Suporte, setup, cura e reposicionamento são alternativas condicionais; confira a situação indicada em cada opção.';}
 if(!recommended.length&&tactical.length){recommended.push(...tactical.slice(0,3));recommendationReason='Não há golpe de dano confirmado; estas opções de suporte dependem das condições indicadas.';}
 const actions=[...attackActions,...switches,...tactical];
 return {actions,recommended:recommended.slice(0,3),recommendationReason,fakeOutRelevant:false,megaAdvice};
}
if(typeof module!=='undefined')module.exports={quickRanking,quickAttacks,quickReason,quickCompareKeys,quickBulkLayers,staySwitchAdvice,individualActionRanking,dreamstoneGyaradosFormAdvice};

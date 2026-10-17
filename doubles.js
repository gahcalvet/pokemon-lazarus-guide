'use strict';
// Pure doubles analysis. Each of two opponents may have one or two selected types.
// Profile-neutral analysis; callers pass the selected roster and its ROM data.
// Ordered criteria and Pareto fronts; no weighted score, simulated HP or KO claim.
function doublePairs(team){return team.flatMap((p,i)=>team.slice(i+1).map(q=>[p,q]))}
function doubleCompare(a,b){return quickCompareKeys(a,b)}
function doubleFacts(name,data){return {...(data.confirmedMoveFacts?.[name]||{}),...(data.doublesMechanics?.[name]||{})}}
function doubleTypeSets(opponents){return opponents.map(entry=>{const types=Array.isArray(entry)?entry:entry&&Array.isArray(entry.types)?entry.types:[entry];return types.filter(Boolean)})}
function doubleOpponentLabel(opponents,i){return doubleTypeSets(opponents)[i].map(t=>TYPES[t]).join('/')}
function doubleMove(p,move,opponents,data){
 const [name,type]=move,facts=doubleFacts(name,data),target=facts.target||'unknown';
 const stats=quickStats(p,data),offenseBase=stats?.[facts.category==='physical'?'atk':facts.category==='special'?'spa':''];
 const itemMultiplier=facts.category==='special'?(data.itemNotes?.[p.item]?.specialMovePowerMultiplier||1):1;
 const known=Number.isFinite(facts.power)&&Number.isFinite(offenseBase),effectivePower=(facts.powerDoublesWithoutItem&&p.item===null?facts.power*2:facts.power)*itemMultiplier;
 const typeSets=doubleTypeSets(opponents);
 return {power:effectivePower,item:p.item,itemMultiplier,offenseBase,known,precision:facts.accuracyMode==='bypass'?'bypass':facts.accuracy,precisionTier:p.ability==='No Guard'||facts.accuracyMode==='bypass'?0:facts.accuracy===100?1:Number.isFinite(facts.accuracy)?2:3,name,type,facts,target,owner:p.name,stab:!!type&&p.types.includes(type),conditional:!!facts.conditionalEffect||!!facts.conditional||QUICK_CONDITIONAL.has(name),priority:!!type&&(Number.isFinite(facts.priority)?facts.priority>0:(data.highPriority||[]).includes(name)),effectiveness:type?typeSets.map(types=>effectiveness(type,types)):[0,0]};
}
function doubleAllyImpact(move,partner){
 if(move.target!=='all-others')return null;
 const byTypes=effectiveness(move.type,partner.types),received=damageTaken(move.type,partner);
 return {partner:partner.name,multiplier:received,natural:byTypes===0,ability:byTypes!==0&&received===0,heals:(move.type==='water'&&partner.ability==='Water Absorb')||(move.type==='electric'&&partner.ability==='Volt Absorb'),protected:false};
}
function doubleActions(p,partner,opponents,data){
 const moves=p.moves.filter(m=>m[1]&&['physical','special'].includes(data.confirmedMoveFacts?.[m[0]]?.category)).map(m=>doubleMove(p,m,opponents,data));
 const sustained=moves.filter(m=>!m.conditional),pool=data.game==='Pokémon Dreamstone Mysteries'?moves:(sustained.length?sustained:moves);
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
  if(p.ability==='Volt Absorb')notes.push({kind:'volt-absorb',owner:p.name,text:`${p.name}: Volt Absorb anula golpes Elétricos afetados e pode recuperar 1/4 do HP máximo; golpes conhecidos e direcionamento dependem do adversário.`});
  if(p.ability==='Static')notes.push({kind:'static',owner:p.name,text:`${p.name}: Static pode paralisar atacantes que usem golpes de contato. Sem o golpe e a habilidade adversários, o efeito não entra nos rankings.`});
  if(p.ability==='Blaze'||p.ability==='Overgrow')notes.push({kind:'low-hp-ability',owner:p.name,text:`${p.name}: ${p.ability} pode fortalecer golpes ${p.ability==='Blaze'?'de Fogo':'de Planta'} com HP baixo; HP atual desconhecido, bônus não presumido.`});
  if(p.ability==='Gluttony')notes.push({kind:'gluttony',owner:p.name,text:`${p.name}: Gluttony altera o limiar de ativação de Berries; Life Orb não é uma Berry, então Gluttony não afeta o item atual.`});
  if(p.ability==='Trace')notes.push({kind:'trace',owner:p.name,text:`${p.name}: Trace copia a habilidade do adversário ao entrar; habilidade adversária desconhecida, nenhum bônus foi presumido.`});
  if(p.ability==='Guts')notes.push({kind:'guts',owner:p.name,text:`${p.name}: Guts aumenta em 50% o Ataque físico enquanto o usuário tem um problema de status; o estado atual é desconhecido, então nenhum bônus foi aplicado.`});
  p.moves.forEach(m=>{
   const move=doubleMove(p,m,opponents,data),f=move.facts;
   if(f.role==='fake-out'){
    const targets=opponents.map((_,i)=>move.effectiveness[i]>0?String.fromCharCode(65+i):null).filter(Boolean);
    notes.push({kind:'fake-out',owner:p.name,targets,text:targets.length?`${p.name}: Fake Out pode interromper o adversário ${targets.join(' ou ')}, apenas no primeiro turno após entrar e se não houver proteção ou imunidade. Disponibilidade neste turno desconhecida.`:`${p.name}: Fake Out é anulado pelos tipos Fantasma selecionados. Não conte com a interrupção.`});
   }
   if(f.role==='protect')notes.push({kind:'protect',owner:p.name,text:`${p.name}: Protect protege o próprio usuário enquanto ${partner.name} pode agir. Não protege diretamente o parceiro; repetições não têm sucesso garantido.`});
   if(f.role==='pivot')notes.push({kind:'pivot',owner:p.name,text:f.category==='status'?`${p.name}: Parting Shot mira um adversário, reduz Ataque e Ataque Especial em 1 estágio e depois troca o usuário se acertar; prioridade normal, sem efeito presumido no outro adversário. Consome a ação.`:`${p.name}: Volt Switch causa dano ao adversário selecionado e troca o usuário depois de acertar; prioridade normal. O usuário pode receber um golpe antes de sair e gasta sua ação.`});
   if(f.role==='heal-ally')notes.push({kind:'heal-ally',owner:p.name,text:`${p.name}: Heal Pulse pode recuperar HP de ${partner.name}, consumindo a ação de ${p.name}. Não cura o próprio usuário e não garante sobreviver até agir.`});
   if(f.role==='heal-self')notes.push({kind:'heal-self',owner:p.name,text:`${p.name}: ${m[0]} recupera HP próprio. Valor depende do HP faltante e do clima; ambos desconhecidos, não é bônus defensivo aplicado ao ranking.`});
   if(f.role==='seed')notes.push({kind:'seed',owner:p.name,text:`${p.name}: Leech Seed pode drenar 1/8 do HP máximo do alvo ao fim dos turnos e devolver ao usuário; requer acerto e falha contra Planta.`});
   if(f.role==='setup'){const labels={attack:'Ataque',specialAttack:'Ataque Especial',defense:'Defesa',specialDefense:'Defesa Especial',speed:'Velocidade'},gains=Object.entries(f.statChanges||{}).filter(([k,v])=>k!=='target'&&v>0).map(([k,v])=>`${labels[k]||k} +${v}`).join(', ');notes.push({kind:'setup',owner:p.name,text:`${p.name}: ${m[0]} prepara o próprio usuário${gains?` (${gains})`:''}; consome este turno e nenhum boost foi aplicado à pressão do turno.`})}
   if(f.role==='status'&&!['Toxic','Hypnosis','Thunder Wave'].includes(m[0]))notes.push({kind:'status',owner:p.name,text:`${p.name}: ${m[0]} tenta aplicar um efeito de status conforme a precisão e as imunidades do alvo; o resultado não é presumido.`});
   if(m[0]==='Rain Dance')notes.push({kind:'weather',owner:p.name,text:`${p.name}: Rain Dance altera o clima do campo por cinco turnos e fortalece golpes de Água. Pode apoiar Waterfall de Gyarados; consome a ação e não causa dano.`});
   if(m[0]==='Charge')notes.push({kind:'setup',owner:p.name,text:`${p.name}: Charge eleva sua Defesa Especial em 1 estágio e dobra o próximo golpe Elétrico antes de sair; prepara Discharge, mas pode atingir o parceiro e consome a ação.`});
   if(m[0]==='Discharge')notes.push({kind:'spread-risk',owner:p.name,text:`${p.name}: Discharge atinge todos os demais Pokémon, inclusive o parceiro, e pode paralisar. nenhum outro integrante atual tem Volt Absorb; o plano de turno evita atingir o parceiro.`});
   if(m[0]==='Earthquake')notes.push({kind:'spread-risk',owner:p.name,text:`${p.name}: Earthquake alcança ambos os adversários e também o parceiro em duplas. O parceiro atual não é imune a Terra; a jogada é excluída do plano seguro e não recebe bônus de área.`});
   if(m[0]==='Will-O-Wisp')notes.push({kind:'status',owner:p.name,text:`${p.name}: Will-O-Wisp tem 85% de precisão e tenta queimar um adversário; não causa dano imediato. Se acertar, pode preparar Hex para um turno futuro, mas o estado do alvo e a ordem de ação são desconhecidos.`});
   if(m[0]==='Hex')notes.push({kind:'conditional',owner:p.name,text:`${p.name}: Hex dobra o poder-base contra um alvo com problema de status. Sem status confirmado, o ranking usa 65 de poder-base; Will-O-Wisp pode habilitar esse efeito em outro turno.`});
   if(m[0]==='Facade')notes.push({kind:'conditional',owner:p.name,text:`${p.name}: Facade tem 70 de poder-base e dobra sob queimadura, paralisia ou envenenamento; Guts também aumenta o Ataque físico em 50% sob status. Sem estado atual confirmado, nenhum bônus foi aplicado.`});
   if(m[0]==='Knock Off')notes.push({kind:'conditional',owner:p.name,text:`${p.name}: Knock Off tenta remover o item do alvo e ganha 50% de poder se ele tiver um item removível. Item adversário desconhecido; o ranking usa 65 de poder-base.`});
   if(m[0]==='Volt Switch')notes.push({kind:'pivot',owner:p.name,text:`${p.name}: Volt Switch causa dano especial ao alvo selecionado e permite reposicionar depois de acertar; pode receber um ataque antes da troca.`});
   if(f.effectChance)notes.push({kind:'secondary-effect',owner:p.name,text:`${p.name}: ${m[0]} ${f.effectChance}; a chance secundária não altera a efetividade básica do golpe no ranking.`});
   if(f.role==='debuff')notes.push({kind:'debuff',owner:p.name,text:`${p.name}: ${m[0]} reduz atributos do(s) alvo(s), mas não causa dano. Alcance em duplas: ${f.target==='both-opponents'?'ambos os adversários':'um adversário selecionado'}.`});
   if(m[0]==='Swords Dance')notes.push({kind:'setup',owner:p.name,text:`${p.name}: Swords Dance aumenta o Ataque físico em dois estágios, usa um turno e não impede os dois adversários de focarem nele. Nenhum boost foi aplicado.`});
   if(m[0]==='Calm Mind')notes.push({kind:'setup',owner:p.name,text:`${p.name}: Calm Mind aumenta Ataque Especial e Defesa Especial em um estágio, usa um turno e não impede os dois adversários de focarem nele. Nenhum boost foi aplicado.`});
   if(f.powerDoublesWithoutItem)notes.push({kind:'item',owner:p.name,text:`${p.name}: Acrobatics tem STAB, mas o bônus sem item não foi presumido. O item equipado precisa estar confirmado.`});
  });
  if(p.moves.some(m=>m[0]==='Hex')&&p.moves.some(m=>m[0]==='Will-O-Wisp'))notes.push({kind:'conditional-synergy',owner:p.name,text:`${p.name}: Will-O-Wisp pode preparar Hex ao queimar o mesmo adversário; os golpes consomem ações em turnos distintos e acerto/ordem não são garantidos.`});
 });
 return notes;
}
function doubleEvaluate(pair,opponents,data){
 const typeSets=doubleTypeSets(opponents);
 const matrix=pair.map(p=>typeSets.map((types,index)=>{const threats=types.map(type=>({type,byTypes:effectiveness(type,p.types),multiplier:damageTaken(type,p),abilityImmunity:effectiveness(type,p.types)!==0&&damageTaken(type,p)===0,solidRock:effectiveness(type,p.types)>1&&p.ability==='Solid Rock'}));return {types,threats,type:types[0],byTypes:threats[0]?.byTypes??1,multiplier:Math.max(...threats.map(x=>x.multiplier)),abilityImmunity:threats.some(x=>x.abilityImmunity),solidRock:threats.some(x=>x.solidRock)}}));
 const values=matrix.flatMap(row=>row.flatMap(cell=>cell.threats.map(x=>x.multiplier))).sort((a,b)=>b-a);
 const shared=typeSets.map((types,i)=>types.some(type=>pair.every(p=>damageTaken(type,p)>1)));
 const offense=doubleOffense(pair,opponents,data),support=doubleSupport(pair,opponents,data);
 const healing=matrix.filter(row=>row.some(cell=>cell.threats.some(x=>x.abilityImmunity&&(x.type==='water'||x.type==='electric')))).length;
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
function doublePositionSupport(p,entering,partner,opponents,data){
 const options=[];
 if(p.ability==='Intimidate')options.push(entering
  ?'Intimidate pode reduzir o Ataque físico dos dois adversários ao entrar, se forem afetados; não altera golpes especiais.'
  :'Intimidate não é reativado por permanecer em campo; qualquer redução anterior não foi presumida.');
 if(p.ability==='Volt Absorb')options.push('Volt Absorb anula golpes Elétricos direcionados a Lanturn e pode recuperar 1/4 do HP máximo; não foi presumido que um adversário usará esse tipo.');
 if(p.ability==='Static')options.push('Static pode paralisar quem atingir o usuário com golpe de contato; o ataque e a habilidade adversários são desconhecidos.');
 if(p.ability==='Blaze'||p.ability==='Overgrow')options.push(`${p.ability} pode fortalecer golpes ${p.ability==='Blaze'?'de Fogo':'de Planta'} com HP baixo; HP atual desconhecido, bônus não presumido.`);
 if(p.ability==='Gluttony')options.push('Gluttony altera o limiar de ativação de Berries; o Life Orb atual não é Berry, então não ativa esse efeito.');
 if(p.ability==='Trace')options.push('Trace copia a habilidade do adversário ao entrar; habilidade adversária desconhecida, benefício não presumido.');
  if(p.ability==='Guts')options.push('Guts aumenta em 50% o Ataque físico quando Obstagoon tem um problema de status; estado não informado, nenhum bônus aplicado.');
 p.moves.forEach(([name])=>{
  const facts=doubleFacts(name,data);
  if(facts.role==='fake-out')options.push('Fake Out tem prioridade +3, mas só funciona no primeiro turno após entrar; não sabemos se essa janela está disponível.');
  if(facts.role==='protect')options.push('Protect pode proteger o usuário enquanto o parceiro age; não protege o parceiro e usos consecutivos não são garantidos.');
  if(facts.role==='setup'){const labels={attack:'Ataque',specialAttack:'Ataque Especial',defense:'Defesa',specialDefense:'Defesa Especial',speed:'Velocidade'},gains=Object.entries(facts.statChanges||{}).filter(([k,v])=>k!=='target'&&v>0).map(([k,v])=>`${labels[k]||k} +${v}`).join(', ');options.push(`${name} consome uma ação e prepara ${gains||'o usuário'} para turnos seguintes; nenhum boost foi presumido.`)}
  if(facts.role==='pivot')options.push(name==='Parting Shot'?'Parting Shot afeta um adversário selecionado, reduz Ataque e Ataque Especial em 1 estágio e troca o usuário se acertar; prioridade normal.':'Volt Switch causa dano em um adversário selecionado e troca o usuário depois de acertar; prioridade normal.');
  if(facts.role==='heal-self')options.push(`${name} recupera HP próprio; valor depende do HP faltante e do clima, que não são conhecidos.`);
  if(facts.role==='seed')options.push('Leech Seed drena HP do alvo ao fim dos turnos se acertar; falha contra Planta e não evita ataques neste turno.');
  if(facts.role==='setup')options.push(`${name} prepara o usuário para o próximo turno; consome a ação atual e nenhum boost foi aplicado ao ranking.`);
  if(facts.role==='status'&&!['Toxic','Hypnosis','Thunder Wave'].includes(name))options.push(`${name} tenta aplicar status; precisão, imunidades e estado do adversário ainda condicionam o efeito.`);
  if(name==='Toxic')options.push('Toxic tenta envenenar gravemente um adversário; não causa dano imediato e depende de precisão, tipo e estado do alvo.');
  if(name==='Hypnosis')options.push('Hypnosis pode pôr um adversário para dormir com 60% de precisão; imunidades e estado do alvo continuam relevantes.');
  if(name==='Thunder Wave')options.push('Thunder Wave pode paralisar um adversário com 90% de precisão; não afeta Terra e depende das demais imunidades/condições.');
  if(name==='Will-O-Wisp')options.push('Will-O-Wisp tem 85% de precisão, tenta queimar um alvo selecionado e não causa dano imediato. A queimadura pode preparar Hex em turno posterior.');
  if(name==='Hex')options.push('Hex dobra o poder contra um alvo com problema de status; sem status confirmado, compara-se o poder-base 65.');
  if(name==='Facade')options.push('Facade dobra o poder sob status; com Guts, Obstagoon também ganha 50% de Ataque físico sob status. O estado atual não foi informado.');
  if(name==='Knock Off')options.push('Knock Off tenta remover o item e ganha 50% de poder apenas contra item removível; item do adversário desconhecido.');
  if(name==='Earthquake')options.push('Earthquake também atinge o parceiro; confira a imunidade a Terra antes de escolher.');
  if(name==='Rain Dance')options.push('Rain Dance cria chuva no campo por cinco turnos e fortalece Waterfall de Gyarados; consome a ação e não causa dano.');
  if(name==='Charge')options.push('Charge eleva a Defesa Especial de Lanturn em um estágio e dobra o próximo golpe Elétrico antes de sair; prepara Discharge, que pode atingir o parceiro.');
  if(name==='Discharge')options.push(partner.ability==='Volt Absorb'?'Discharge alcança todos os outros Pokémon; o parceiro é imune por Volt Absorb e pode recuperar HP.':'Discharge alcança todos os outros Pokémon, inclusive o parceiro. A análise exclui a jogada se o aliado receber dano; trocas de ação podem evitar o risco.');
  if(facts.role==='debuff')options.push(`${name} reduz atributo(s) do alvo; em duplas atinge ${facts.target==='both-opponents'?'ambos os adversários':'um adversário selecionado'} e não causa dano neste turno.`);
 });
 return options;
}
function doublePositionAssessment(candidate,opponents,currentNames,data){
 const threats=candidate.row.matrix.flatMap(row=>row.flatMap(cell=>cell.threats)),counts={
  immunity:threats.filter(t=>t.multiplier===0).length,
  resistance:threats.filter(t=>t.multiplier>0&&t.multiplier<1).length,
  neutral:threats.filter(t=>t.multiplier===1).length,
  weakness:threats.filter(t=>t.multiplier>1).length
 };
 const actions=candidate.row.offense.actions.map(a=>a.name?`${a.owner}: ${a.name} contra ${a.targets.map(i=>String.fromCharCode(65+i)).join('/')} (${a.targets.map(i=>quickFactor(a.coverage[i])).join('/')})${a.stab?' com STAB':''}${a.priority&&!a.conditional?' prioridade +'+(a.facts.priority||1):''}`:`${a.owner}: sem ataque sustentado confirmado`);
 const support=candidate.slots.flatMap((p,i)=>doublePositionSupport(p,candidate.changed[i],candidate.slots[1-i],opponents,data).map(text=>`${p.name}: ${text}`));
 const outgoing=candidate.changed.map((changed,i)=>changed?currentNames[i]:null).filter(Boolean);
 return {counts,actions,support,outgoing,cost:candidate.count};
}
function doublePosition(rows,current,opponents,data){
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
 const assess=candidate=>({...candidate,assessment:doublePositionAssessment(candidate,opponents,currentNames,data)});
 if(sufficient(existing))return {...assess(keep),patterns,adequate:true,classification:'clear',reason:'A dupla atual não recebe dano super efetivo dos tipos informados e consegue responder aos dois adversários com golpes ao menos neutros. Permanecer preserva as duas ações; HP, movimentos e velocidade adversários ainda podem mudar a decisão.'};
 // Demand a meaningful reduction of the largest exposure, shared weaknesses,
 // or unanswerable targets; never switch merely to win a base-stat tie.
 const risk=r=>[r.values[0],r.shared.filter(Boolean).length,r.values.filter(n=>n>1).length,r.offense.coverage.filter(n=>n===0).length];
 const improves=r=>doubleCompare(risk(r),risk(existing))<0&&r.values[0]<=existing.values[0];
 const singles=[...patterns.swapFirst,...patterns.swapSecond].filter(x=>improves(x.row));
 singles.sort((a,b)=>doubleCompare(risk(a.row),risk(b.row))||doubleCompare(a.row.balancedKey,b.row.balancedKey));
 const adequateSingle=singles.find(x=>sufficient(x.row));
 if(adequateSingle)return {...assess(adequateSingle),patterns,adequate:false,classification:'clear',reason:'Uma troca remove as fraquezas de tipo relevantes e mantém uma resposta ao tipo de cada adversário. O parceiro conserva sua ação; o entrante gasta o turno trocando e ainda pode receber ataques.'};
 const doubles=patterns.swapBoth.filter(x=>improves(x.row));
 doubles.sort((a,b)=>doubleCompare(risk(a.row),risk(b.row))||doubleCompare(a.row.balancedKey,b.row.balancedKey));
 if(doubles[0]&&!adequateSingle&&sufficient(doubles[0].row))return {...assess(doubles[0]),patterns,adequate:false,classification:'clear',reason:'Nenhuma troca única deixa os dois slots sem fraqueza relevante e com resposta ofensiva aos dois tipos. A troca dupla alcança isso, mas gasta ambas as ações; os dois entrantes ainda podem receber ataques.'};
 const bestPartial=singles[0]||doubles[0];
 if(bestPartial){
  const candidate=assess(bestPartial),count=candidate.assessment.counts;
  const bestRisk=candidate.row.values.filter(n=>n>1).length,currentRisk=existing.values.filter(n=>n>1).length;
  return {...candidate,slots:keep.slots,changed:[false,false],count:0,pattern:'situational',patterns,adequate:false,classification:'situational',partialAlternative:candidate,reason:`Há uma alternativa que reduz algumas das ${currentRisk} fraquezas de tipo possíveis para ${bestRisk}, mas ainda deixa uma escolha entre exposição defensiva, pressão ofensiva e ações consumidas pela troca. Sem HP, golpes, alvos e velocidade adversários, a decisão é situacional.`};
 }
 return {...assess(keep),patterns,adequate:false,classification:'situational',pattern:'situational',reason:'Os tipos não mostram uma troca com ganho defensivo claro que compense as ações perdidas. Suportes como Fake Out dependem do turno de entrada; Parting Shot tem alcance em duplas não confirmado. Sem HP, golpes, alvos e velocidade adversários, a decisão é situacional.'};
}
function doubleTurnPlan(position,opponents,data){
 if(!position)return null;
 const labels=['A','B'],base=position.pattern==='situational'?position.patterns.keep[0]:position;
 const selected=base||position,actions=[],swaps=[];
 selected.slots.forEach((p,i)=>{
  if(selected.changed[i])swaps.push({owner:selected.changed[i]?position.patterns.keep[0].slots[i].name:p.name,incoming:p.name,slot:i});
 });
 if(selected.count===2){
  return {pattern:position.pattern,actions:[],swaps,future:selected.row.offense.actions,notes:[],fakeOut:null};
 }
 const availableOwners=selected.slots.filter((_,i)=>!selected.changed[i]).map(p=>p.name);
 selected.row.offense.actions.filter(a=>availableOwners.includes(a.owner)).forEach(a=>actions.push(a));
 const fakeOwner=selected.slots.findIndex((p,i)=>!selected.changed[i]&&p.name==='Torracat');
 let fakeOut=null;
 if(fakeOwner>=0){
  const p=selected.slots[fakeOwner],move=p.moves.find(m=>m[0]==='Fake Out');
  if(move){
   const attack=doubleMove(p,move,opponents,data),legal=attack.effectiveness.map((n,i)=>n>0?i:-1).filter(i=>i>=0);
   const partner=selected.slots[1-fakeOwner],partnerActions=selected.changed[1-fakeOwner]?[]:selected.row.offense.actions.filter(a=>a.owner===partner.name);
   const partnerAction=partnerActions[0]||null;
   const candidates=legal.map(target=>({target,partnerAction}));
   fakeOut={owner:p.name,legalTargets:legal,candidates,partnerAction,unavailableActions:actions.slice(),conditional:true,uncertainTarget:legal.length>1,immuneTargets:attack.effectiveness.map((n,i)=>n===0?i:-1).filter(i=>i>=0)};
  }
 }
 const notes=[];
 if(selected.slots.some((p,i)=>p.name==='Gyarados'&&!selected.changed[i])){const formAdvice=dreamstoneGyaradosFormAdvice(doubleTypeSets(opponents).flat(),data);if(formAdvice)notes.push(formAdvice.text);}
 selected.slots.forEach((p,i)=>{
  if(selected.changed[i])return;
  const facts=p.moves.map(([name])=>({name,...doubleFacts(name,data)}));
  if(facts.some(f=>f.role==='pivot'))notes.push(...facts.filter(f=>f.role==='pivot').map(f=>f.name==='Parting Shot'?`${p.name}: Parting Shot mira um adversário, reduz Ataque e Ataque Especial em 1 estágio e troca o usuário se acertar; prioridade normal e uma ação consumida.`:`${p.name}: Volt Switch causa dano a um adversário selecionado e troca o usuário depois de acertar; prioridade normal, uma ação consumida.`));
  if(facts.some(f=>f.role==='protect'))notes.push(`${p.name}: Protect pode proteger apenas o usuário; sucesso em usos consecutivos não é garantido.`);
  const setup=facts.find(f=>f.role==='setup');
  if(setup)notes.push(`${p.name}: ${setup.name} é uma alternativa ao ataque deste turno; consome a ação e só ajuda depois, se o usuário puder permanecer em campo. O parceiro ainda pode agir; nenhum boost foi presumido.`);
  facts.forEach(f=>{
   if(f.name==='Rain Dance')notes.push(`${p.name}: Rain Dance altera o clima por cinco turnos e fortalece Waterfall de Gyarados; é uma ação de suporte, não dano imediato.`);
   if(f.name==='Charge')notes.push(`${p.name}: Charge aumenta Defesa Especial em 1 estágio e dobra o próximo golpe Elétrico; Discharge alcança o parceiro, então não foi selecionado como ataque seguro.`);
   if(f.name==='Leech Seed')notes.push(`${p.name}: Leech Seed pode drenar 1/8 do HP máximo ao fim dos turnos e curar o usuário; falha contra Planta e não causa dano imediato.`);
   if(f.name==='Synthesis')notes.push(`${p.name}: Synthesis recupera HP do usuário; a quantidade depende do clima e do HP faltante, que não são conhecidos.`);
   if(f.name==='Toxic')notes.push(`${p.name}: Toxic tenta envenenar gravemente um adversário, mas não causa dano imediato e depende de acerto e imunidades.`);
   if(f.name==='Hypnosis')notes.push(`${p.name}: Hypnosis tem 60% de precisão contra um alvo selecionado; sono e imunidades do alvo não são conhecidos.`);
   if(f.name==='Thunder Wave')notes.push(`${p.name}: Thunder Wave tem 90% de precisão contra um alvo selecionado; não afeta Terra e não causa dano.`);
   if(f.conditionalEffect)notes.push(`${p.name}: ${f.name} tem bônus condicional (${f.conditionalEffect}); a condição não foi presumida e o ranking usa poder-base.`);
   if(f.name==='Will-O-Wisp'&&p.moves.some(m=>m[0]==='Hex'))notes.push(`${p.name}: Will-O-Wisp pode preparar Hex ao queimar um alvo; as duas ações ocorrem em turnos distintos e acerto/ordem não são garantidos.`);
   if(f.name==='Dragon Dance')notes.push(`${p.name}: Dragon Dance aumenta Ataque e Velocidade em 1 estágio, mas consome a ação deste turno; nenhum boost foi presumido.`);
   if(f.name==='Earthquake')notes.push(`${p.name}: Earthquake atinge o parceiro em duplas; confira a imunidade a Terra antes de usar. O Obstagoon atual recebe dano de Terra.`);
   if(f.name==='Facade'&&p.ability==='Guts')notes.push(`${p.name}: Facade dobra poder sob status, enquanto Guts aumenta Ataque físico em 50%; estado não informado, nenhum bônus aplicado.`);
   if(f.name==='Knock Off')notes.push(`${p.name}: Knock Off remove item e só ganha 50% de poder se o alvo tiver item removível; item adversário desconhecido.`);
   if(f.name==='Volt Switch')notes.push(`${p.name}: Volt Switch causa dano e reposiciona depois de acertar um alvo selecionado; gastar a ação de ataque também resulta na troca.`);
  });
 });
 return {pattern:position.pattern,actions,swaps,future:null,notes,fakeOut};
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
 const damageEntries=team.flatMap(p=>p.moves.filter(m=>m[1]&&['physical','special'].includes(data.confirmedMoveFacts?.[m[0]]?.category)).map(m=>doubleMove(p,m,opponents,data)));
 const comparable=damageEntries.every(m=>m.known);
 const analysisData={...data,pressureComparable:comparable};
 const all=doublePairs(team).map(pair=>doubleEvaluate(pair,opponents,analysisData)),rankings=doubleRankRows(all);
 const eligible=allies.length===1?all.filter(r=>r.pair.some(p=>p.name===allies[0])):all;
 const eligibleRanks=allies.length===1?doubleRankRows(eligible.map(r=>({...r}))):rankings;
 const warnings=[];
 if(team.some(p=>!QUICK_KNOWN_ABILITIES.has(p.ability)))warnings.push('Há habilidade sem mecânica incorporada; nenhum efeito defensivo novo foi presumido.');
 const damageMoves=team.flatMap(p=>p.moves.filter(m=>m[1]&&['physical','special'].includes(data.confirmedMoveFacts?.[m[0]]?.category)).map(m=>doubleMove(p,m,opponents,data)));
 if(!damageMoves.every(m=>Number.isFinite(m.facts.power)&&(Number.isFinite(m.facts.accuracy)||m.facts.accuracyMode==='bypass')&&['physical','special'].includes(m.facts.category)))warnings.push('Poder, precisão ou categoria de algum golpe ainda não foram confirmados. Não entram na comparação de pressão ofensiva.');
 if(team.some(p=>p.moves.some(m=>doubleFacts(m[0],data).target==='unknown')))warnings.push('Parting Shot: a documentação menciona os alvos afetados, mas não confirma o alcance em duplas. Nenhum bônus de área foi aplicado.');
 if(!team.every(p=>quickStats(p,data)))warnings.push('Há atributos base não verificados; eles não foram usados nos desempates afetados.');
 const position=allies.length===2?doublePosition(all,allySlots.map(n=>team.find(p=>p.name===n)),opponents,analysisData):null;
 const turnPlan=position?doubleTurnPlan(position,opponents,analysisData):null;
 return {valid:true,opponents:typeSets.map(types=>types.slice()),all,rankings,recommendations:eligibleRanks,eligibleCount:eligible.length,pinned:allies.length===1?allies[0]:null,position,turnPlan,warnings};
}
function doubleDefenseText(r,opponents){return r.pair.map((p,i)=>`${p.name}: ${r.matrix[i].map((x,j)=>x.threats.map(t=>`${String.fromCharCode(65+j)} ${TYPES[t.type]} ${quickFactor(t.multiplier)}${t.abilityImmunity?' por habilidade de absorção':t.multiplier===0?' por tipagem':t.solidRock?' com Solid Rock':''}`).join(' · ')).join(' · ')}`).join('; ')+'.'}
function doubleOffenseText(r){return r.offense.actions.map(a=>a.name?`${a.owner} → ${a.targets.map(i=>String.fromCharCode(65+i)).join(' e ')}: ${a.name} ${a.targets.map(i=>quickFactor(a.coverage[i])).join('/')} ${a.stab?'com STAB ':''}· poder-base ${a.facts.power}${a.itemMultiplier!==1?` × ${a.itemMultiplier} por ${a.item}`:''} · ${a.facts.category==='special'?'especial':'físico'} · precisão ${a.facts.accuracy}${a.precision==='bypass'?' (não testa precisão)':''}${a.priority&&!a.conditional?' · prioridade +'+(a.facts.priority||1):''} ${a.conditional?'· bônus condicional não aplicado ':''}`:`${a.owner}: sem ataque sustentado confirmado`).join('; ')+'.'}
function doublePairReason(r,opponents,kind){
 const sets=doubleTypeSets(opponents);
 const shared=r.shared.flatMap((yes,i)=>yes?[`${String.fromCharCode(65+i)} (${sets[i].map(t=>TYPES[t]).join('/')}) ameaça os dois aliados super efetivamente.`]:[]);
 const complement=sets.flatMap((types,i)=>types.flatMap(t=>r.matrix[0][i].threats.find(x=>x.type===t).multiplier>1&&r.matrix[1][i].threats.find(x=>x.type===t).multiplier<1?[`${r.pair[1].name} resiste a ${TYPES[t]}, que ameaça ${r.pair[0].name}; isso não redireciona ataques.`]:r.matrix[1][i].threats.find(x=>x.type===t).multiplier>1&&r.matrix[0][i].threats.find(x=>x.type===t).multiplier<1?[`${r.pair[0].name} resiste a ${TYPES[t]}, que ameaça ${r.pair[1].name}; isso não redireciona ataques.`]:[]));
 return (kind==='offensive'?[doubleOffenseText(r),doubleDefenseText(r,opponents)]:[doubleDefenseText(r,opponents),doubleOffenseText(r)]).concat(shared,kind==='balanced'?complement:[]).join(' ');
}
if(typeof module!=='undefined')module.exports={doublePairs,doubleMove,doubleAllyImpact,doubleActions,doubleOffense,doubleEvaluate,doubleRankRows,doublePosition,doublePositionAssessment,doublePositionSupport,doubleTurnPlan,doubleAnalyze,doublePairReason};

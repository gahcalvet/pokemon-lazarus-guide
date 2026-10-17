'use strict';
// Isolated UI: existing individual state and rendering are left intact.
const doublesState={opponents:[['',''],['','']],allies:['',''],criterion:'balanced'};
const doubleLabels={defensive:'Melhor dupla defensiva',offensive:'Melhor dupla ofensiva',balanced:'Melhor dupla equilibrada'};
function doubleSelectOptions(values,placeholder,blocked=''){return `<option value="">${placeholder}</option>`+values.map(([value,label])=>`<option value="${escapeQuick(value)}" ${value===blocked?'disabled':''}>${escapeQuick(label)}</option>`).join('')}
function doublePairTitle(row){return row.pair.map(p=>p.name).join(' + ')}
function doubleCard(row,kind,opponents){return `<article class="quick-card doubles-card"><h3>${{defensive:'🛡️',offensive:'⚔️',balanced:'◈'}[kind]} ${doubleLabels[kind]}</h3><div class="doubles-pick"><div>${row.pair.map(p=>quickPortrait(p.name)).join('')}</div><strong>${escapeQuick(doublePairTitle(row))}</strong></div>${row.tied?'<span class="quick-tie">Empate técnico na liderança</span>':''}<p>${escapeQuick(doublePairReason(row,opponents,kind))}</p><details><summary>Sinergia e cuidados</summary>${row.support.length?row.support.map(n=>`<p>${escapeQuick(n.text)}</p>`).join(''):'<p>Sem suporte complementar confirmado nesta dupla.</p>'}${row.hazards.map(h=>`<p>${escapeQuick(h.move.name)}: ${escapeQuick(h.impact.partner)} recebe ${quickFactor(h.impact.multiplier)}${h.impact.heals?' e pode recuperar HP por Water Absorb':''}. Protect não foi presumido.</p>`).join('')}</details></article>`}
function doublePositionOptionHTML(option,label,opponents,original,data){
 const info=doublePositionAssessment(option,opponents,original,data),c=info.counts;
 const defense=`Defesa: ${c.immunity} imunidades, ${c.resistance} resistências, ${c.neutral} danos neutros e ${c.weakness} fraquezas entre as ameaças de tipo selecionadas; elas não são presumidas simultâneas.`;
 const offense=option.row.offense.actions.map(a=>{const slot=option.slots.findIndex(p=>p.name===a.owner),phase=option.changed[slot]?'após a entrada':'se permanecer neste turno';return a.name?`${a.owner} ${phase}: ${a.name} contra ${a.targets.map(i=>String.fromCharCode(65+i)).join('/')} (${a.targets.map(i=>quickFactor(a.coverage[i])).join('/')})${a.stab?' com STAB':''}${a.priority&&!a.conditional?' · prioridade +'+(a.facts.priority||1):''}`:`${a.owner}: sem ataque sustentado confirmado`}).join('; ');
 const cost=option.count===0?'Custo: nenhuma troca; as duas ações permanecem disponíveis.':option.count===1?`Custo: ${info.outgoing[0]} perde a ação deste turno para trocar; o parceiro que fica ainda pode agir.`:'Custo: os dois slots gastam a ação trocando; nenhum entrante ataca neste turno.';
 const support=info.support.length?`Suporte ou habilidade condicional: ${info.support.join(' ')}`:'Suporte ou habilidade: nenhum benefício adicional confirmado para esta decisão.';
 return `<p><strong>${label}:</strong> ${escapeQuick(option.slots.map(p=>p.name).join(' + '))}. ${escapeQuick(defense)} ${escapeQuick(`Plano ofensivo: ${offense||'sem plano confirmado'}.`)} ${escapeQuick(cost)} ${escapeQuick(support)}</p>`;
}
function doubleActionLine(action){
 if(!action||!action.name)return `${action?.owner||'Pokémon'}: sem ataque confirmado para este turno.`;
 const targets=action.targets.map(i=>`Adversário ${String.fromCharCode(65+i)}`).join(' e ');
 const factors=action.targets.map(i=>quickFactor(action.coverage[i])).join('/');
 return `${action.owner}: ${action.name} → ${targets} (${factors}${action.stab?' · STAB':''}${action.priority?` · prioridade +${action.facts.priority}`:''}).`;
}
function doubleTurnPlanHTML(position,plan){
 if(!plan)return '';
 const lines=[];
 if(plan.swaps.length===2){
  plan.swaps.forEach(s=>lines.push(`<p><strong>${escapeQuick(s.owner)}:</strong> trocar → ${escapeQuick(s.incoming)} (ação consumida).</p>`));
  lines.push('<p>As duas ações deste turno são consumidas pelas trocas.</p>');
 }else{
  plan.swaps.forEach(s=>lines.push(`<p><strong>${escapeQuick(s.owner)}:</strong> trocar → ${escapeQuick(s.incoming)} (ação consumida).</p>`));
  plan.actions.forEach(a=>lines.push(`<p>${escapeQuick(doubleActionLine(a))}</p>`));
 }
 if(!plan.swaps.length&&!plan.actions.length)lines.push('<p>Não há uma ação ofensiva confirmada para sugerir neste turno.</p>');
 if(plan.future?.length)lines.push(`<p class="double-plan-future"><strong>Próximo turno, após as entradas:</strong> ${escapeQuick(plan.future.map(doubleActionLine).join(' '))}</p>`);
 if(position.pattern==='situational'&&position.partialAlternative){
  const alt=position.partialAlternative,changed=alt.slots.map((p,i)=>alt.changed[i]?`${doublesState.allies[i]} → ${p.name}`:null).filter(Boolean);
  if(changed.length)lines.push(`<p class="double-plan-note"><strong>Alternativa parcial:</strong> ${escapeQuick(changed.join(' · '))}; ainda há incerteza sobre risco e valor das ações.</p>`);
 }
 if(plan.fakeOut){
  const f=plan.fakeOut;
  lines.push('<div class="double-fakeout"><strong>Fake Out, se disponível</strong><p class="double-plan-note">Cenário indisponível: use o plano principal acima. A janela depende de Torracat ter acabado de entrar.</p>');
  if(!f.legalTargets.length)lines.push('<p class="double-plan-note">Cenário disponível: Fake Out não atinge os tipos selecionados (imunidade a Normal); mantenha a ação principal.</p>');
  else{
   const targetText=f.uncertainTarget?`alvo situacional: ${f.legalTargets.map(i=>`Adversário ${String.fromCharCode(65+i)}`).join(' ou ')}`:`Adversário ${String.fromCharCode(65+f.legalTargets[0])}`;
   lines.push(`<p>Torracat: Fake Out → ${escapeQuick(targetText)} (prioridade +3; interrupção não garantida).</p>`);
   if(f.partnerAction)lines.push(`<p>${escapeQuick(doubleActionLine(f.partnerAction))}</p>`);
   else lines.push('<p>O parceiro troca neste turno e não realiza ataque.</p>');
   lines.push('<p class="double-plan-note">O plano com Fake Out é uma alternativa condicional; sem dados dos adversários, não é possível concluir que supera o ataque ou Parting Shot.</p>');
  }
  lines.push('</div>');
 }
 if(plan.notes.length)lines.push(`<p class="double-plan-note">${escapeQuick(plan.notes.join(' '))}</p>`);
 return `<section class="double-action-plan"><span class="eyebrow">PLANO DE AÇÃO SUGERIDO</span>${lines.join('')}</section>`;
}
function doublePositionHTML(position,opponents,data){
 const labels={keep:'Manter a dupla atual',swapFirst:'Trocar o aliado 1',swapSecond:'Trocar o aliado 2',swapBoth:'Trocar os dois aliados',situational:'Decisão situacional'};
 const original=doublesState.allies;
 const changes=position.pattern==='situational'?'Sem troca com vantagem clara pelos dados disponíveis.':position.slots.map((p,i)=>position.changed[i]?`${original[i]} → ${p.name}`:`${p.name} permanece`).join(' · ');
 const patterns=Object.entries({keep:'Manter os dois',swapSecond:'Trocar apenas o aliado 2',swapFirst:'Trocar apenas o aliado 1',swapBoth:'Trocar os dois'}).map(([key,label])=>{const options=position.patterns[key].slice().sort((a,b)=>doubleCompare(a.row.balancedKey,b.row.balancedKey));const candidate=options[0];return candidate?doublePositionOptionHTML(candidate,label,opponents,original,data):''}).join('');
 return `<article class="doubles-position"><span class="eyebrow">POSIÇÃO ATUAL</span><h3>${labels[position.pattern]}</h3><strong>${escapeQuick(changes)}</strong><p>${escapeQuick(position.reason)}</p>${doubleTurnPlanHTML(position,position.turnPlan||doubleTurnPlan(position,opponents,data))}<details><summary>Comparar as quatro alternativas</summary>${patterns}<p>${escapeQuick(doubleDefenseText(position.row,opponents))}</p><p>Plano ofensivo ${position.count?'após a entrada':'da dupla'}: ${escapeQuick(doubleOffenseText(position.row))}</p></details></article>`;
}
function renderDoubles(){
 const output=document.querySelector('#doubles-results'),prompt=document.querySelector('#doubles-prompt');
 if(activeGame==='dreamstone'){output.hidden=true;prompt.hidden=false;prompt.textContent='Análise de duplas Dreamstone indisponível: os tipos, efeitos dos golpes e regras deste ROM ainda não foram confirmados. Os Pokémon selecionados abaixo vêm do perfil Dreamstone; nenhum cálculo ou dado de Lazarus é reutilizado.';return}
 if(!team.length){output.hidden=true;prompt.textContent='Carregando a equipe confirmada…';return}
 if(battleData.unavailable){output.hidden=true;prompt.textContent='Os dados de batalha não carregaram. O guia individual continua disponível.';return}
 const result=doubleAnalyze(doublesState.opponents,team,battleData,doublesState.allies);
 output.hidden=!result.valid;prompt.hidden=result.valid;
 if(!result.valid){prompt.textContent=result.error;return}
 const pinned=result.pinned?`Mantendo ${result.pinned}: ${result.eligibleCount} parceiros possíveis.`:'15 duplas possíveis com o sexteto confirmado.';
 document.querySelector('#doubles-context').textContent=`A: ${result.opponents[0].map(t=>TYPES[t]).join('/')} · B: ${result.opponents[1].map(t=>TYPES[t]).join('/')}. ${pinned}`;
 document.querySelector('#doubles-cards').innerHTML=Object.keys(doubleLabels).map(kind=>doubleCard(result.recommendations[kind][0],kind,result.opponents)).join('');
 document.querySelector('#doubles-position').innerHTML=result.position?doublePositionHTML(result.position,result.opponents,battleData):'';
 document.querySelector('#doubles-warnings').textContent=result.warnings.join(' ');
 const list=result.rankings[doublesState.criterion];
 document.querySelector('#doubles-list').innerHTML=list.map(r=>`<li value="${r.rank}"><strong>${escapeQuick(doublePairTitle(r))}</strong>${r.tied?'<span class="quick-tie"> · empate técnico</span>':''}${result.pinned&&!r.pair.some(p=>p.name===result.pinned)?'<span class="quick-tie"> · exige retirar o aliado fixado</span>':''}<p>${escapeQuick(doublePairReason(r,result.opponents,doublesState.criterion))}</p></li>`).join('');
}
function initDoubles(){
 const typeOptions=Object.entries(TYPES),allyOptions=team.map(p=>[p.name,p.name]);
 doublesState.alliesByGame={lazarus:doublesState.allies.slice(),dreamstone:['','']};
 [0,1].forEach(i=>{
  const opponent=document.querySelector(`#enemy-${i}-0`),secondary=document.querySelector(`#enemy-${i}-1`),ally=document.querySelector(`#ally-${i}`);
  opponent.innerHTML=doubleSelectOptions(typeOptions,'Tipo principal');secondary.innerHTML=doubleSelectOptions(typeOptions,'Segundo tipo (opcional)');
  ally.innerHTML=doubleSelectOptions(allyOptions,'Não informado');
  opponent.value=doublesState.opponents[i][0];secondary.value=doublesState.opponents[i][1];ally.value=doublesState.allies[i];
  const updateOpponent=()=>{if(opponent.value&&opponent.value===secondary.value)secondary.value='';doublesState.opponents[i]=[opponent.value,secondary.value];secondary.innerHTML=doubleSelectOptions(typeOptions,'Segundo tipo (opcional)',opponent.value);secondary.value=doublesState.opponents[i][1];opponent.innerHTML=doubleSelectOptions(typeOptions,'Tipo principal',secondary.value);opponent.value=doublesState.opponents[i][0];renderDoubles()};
  opponent.addEventListener('change',updateOpponent);secondary.addEventListener('change',updateOpponent);
  ally.addEventListener('change',()=>{doublesState.allies[i]=ally.value;doublesState.alliesByGame[activeGame]=doublesState.allies.slice();const options=(activeGame==='dreamstone'?dreamstoneTeam:team).map(p=>[p.name,p.name]);[0,1].forEach(j=>{const select=document.querySelector(`#ally-${j}`);select.innerHTML=doubleSelectOptions(options,'Não informado',doublesState.allies[1-j]);select.value=doublesState.allies[j]});renderDoubles()});
 });
 document.querySelector('#doubles-criterion').addEventListener('change',e=>{doublesState.criterion=e.target.value;renderDoubles()});
 document.querySelectorAll('[data-battle-mode]').forEach(button=>button.addEventListener('click',()=>{
  const dual=button.dataset.battleMode==='double';
  document.querySelector('#individual-guide').hidden=dual;document.querySelector('#doubles-guide').hidden=!dual;document.querySelector('#search').closest('label').hidden=dual;
  document.querySelectorAll('[data-battle-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  if(dual)renderDoubles();
 }));
 renderDoubles();
}
function setDoublesRoster(roster,game){
 if(!document.querySelector('#ally-0'))return;
 doublesState.alliesByGame=doublesState.alliesByGame||{lazarus:['',''],dreamstone:['','']};
 doublesState.allies=doublesState.alliesByGame[game].slice();
 const options=roster.map(p=>[p.name,p.name]);
 [0,1].forEach(i=>{const select=document.querySelector(`#ally-${i}`);select.innerHTML=doubleSelectOptions(options,'Não informado',doublesState.allies[1-i]);select.value=doublesState.allies[i]});
}


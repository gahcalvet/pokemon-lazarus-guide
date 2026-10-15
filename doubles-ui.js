'use strict';
// Isolated UI: existing individual state and rendering are left intact.
const doublesState={opponents:[['',''],['','']],allies:['',''],criterion:'balanced'};
const doubleLabels={defensive:'Melhor dupla defensiva',offensive:'Melhor dupla ofensiva',balanced:'Melhor dupla equilibrada'};
function doubleSelectOptions(values,placeholder,blocked=''){return `<option value="">${placeholder}</option>`+values.map(([value,label])=>`<option value="${escapeQuick(value)}" ${value===blocked?'disabled':''}>${escapeQuick(label)}</option>`).join('')}
function doublePairTitle(row){return row.pair.map(p=>p.name).join(' + ')}
function doubleCard(row,kind,opponents){return `<article class="quick-card doubles-card"><h3>${{defensive:'🛡️',offensive:'⚔️',balanced:'◈'}[kind]} ${doubleLabels[kind]}</h3><div class="doubles-pick"><div>${row.pair.map(p=>quickPortrait(p.name)).join('')}</div><strong>${escapeQuick(doublePairTitle(row))}</strong></div>${row.tied?'<span class="quick-tie">Empate técnico na liderança</span>':''}<p>${escapeQuick(doublePairReason(row,opponents,kind))}</p><details><summary>Sinergia e cuidados</summary>${row.support.length?row.support.map(n=>`<p>${escapeQuick(n.text)}</p>`).join(''):'<p>Sem suporte complementar confirmado nesta dupla.</p>'}${row.hazards.map(h=>`<p>${escapeQuick(h.move.name)}: ${escapeQuick(h.impact.partner)} recebe ${quickFactor(h.impact.multiplier)}${h.impact.heals?' e pode recuperar HP por Water Absorb':''}. Protect não foi presumido.</p>`).join('')}</details></article>`}
function doublePositionHTML(position,opponents,data){
 const labels={keep:'Manter a dupla atual',swapFirst:'Trocar o aliado 1',swapSecond:'Trocar o aliado 2',swapBoth:'Trocar os dois aliados'};
 const original=doublesState.allies;
 const changes=position.slots.map((p,i)=>position.changed[i]?`${original[i]} → ${p.name}`:`${p.name} permanece`).join(' · ');
 const stayActions=position.slots.flatMap((p,i)=>position.changed[i]?[]:[p]);
 const moves=stayActions.map(p=>`${p.name}: ${p.moves.map(m=>m[0]).join(', ')} (uma ação)`).join('; ');
 const improvements=position.slots.flatMap((p,i)=>position.changed[i]?doubleTypeSets(opponents).flatMap((types,j)=>types.map(type=>{const old=damageTaken(type,team.find(p=>p.name===original[i])),next=damageTaken(type,p);return `${p.name} recebe ${quickFactor(next)} de ${TYPES[type]} (antes ${quickFactor(old)} com ${original[i]})` })):[]).join('; ');
 const patterns=Object.entries(labels).map(([key,label])=>{const options=position.patterns[key].slice().sort((a,b)=>doubleCompare(a.row.balancedKey,b.row.balancedKey));const candidate=options[0];return candidate?`<p><strong>${label}:</strong> ${escapeQuick(candidate.slots.map(p=>p.name).join(' + '))} · ${candidate.count} ${candidate.count===1?'ação de troca':'ações de troca'} · maior exposição ${quickFactor(candidate.row.values[0])}.</p>`:''}).join('');
 return `<article class="doubles-position"><span class="eyebrow">POSIÇÃO ATUAL</span><h3>${labels[position.pattern]}</h3><strong>${escapeQuick(changes)}</strong><p>${escapeQuick(position.reason)}</p>${improvements?`<p>${escapeQuick(improvements)}.</p>`:''}<p>${position.count===0?'Duas ações preservadas.':position.count===1?'Uma ação de troca; o parceiro que fica pode agir.':'Duas ações de troca; nenhum entrante ataca neste turno.'}</p>${moves?`<p class="quick-muted">Disponíveis neste turno, sujeitos às condições de cada golpe: ${escapeQuick(moves)}.</p>`:''}<details><summary>Comparar as quatro alternativas</summary>${patterns}<p>${escapeQuick(doubleDefenseText(position.row,opponents))}</p><p>Plano ofensivo ${position.count?'após a entrada':'da dupla'}: ${escapeQuick(doubleOffenseText(position.row))}</p></details></article>`;
}
function renderDoubles(){
 const output=document.querySelector('#doubles-results'),prompt=document.querySelector('#doubles-prompt');
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
 [0,1].forEach(i=>{
  const opponent=document.querySelector(`#enemy-${i}-0`),secondary=document.querySelector(`#enemy-${i}-1`),ally=document.querySelector(`#ally-${i}`);
  opponent.innerHTML=doubleSelectOptions(typeOptions,'Tipo principal');secondary.innerHTML=doubleSelectOptions(typeOptions,'Segundo tipo (opcional)');
  ally.innerHTML=doubleSelectOptions(allyOptions,'Não informado');
  opponent.value=doublesState.opponents[i][0];secondary.value=doublesState.opponents[i][1];ally.value=doublesState.allies[i];
  const updateOpponent=()=>{if(opponent.value&&opponent.value===secondary.value)secondary.value='';doublesState.opponents[i]=[opponent.value,secondary.value];secondary.innerHTML=doubleSelectOptions(typeOptions,'Segundo tipo (opcional)',opponent.value);secondary.value=doublesState.opponents[i][1];opponent.innerHTML=doubleSelectOptions(typeOptions,'Tipo principal',secondary.value);opponent.value=doublesState.opponents[i][0];renderDoubles()};
  opponent.addEventListener('change',updateOpponent);secondary.addEventListener('change',updateOpponent);
  ally.addEventListener('change',()=>{doublesState.allies[i]=ally.value;[0,1].forEach(j=>{const select=document.querySelector(`#ally-${j}`);select.innerHTML=doubleSelectOptions(allyOptions,'Não informado',doublesState.allies[1-j]);select.value=doublesState.allies[j]});renderDoubles()});
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

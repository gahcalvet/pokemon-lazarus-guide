'use strict';
// Regression checks use an independent, frozen reference; never runtime CHART
// to generate expected values. Rock Tomb is current; Rock Smash exists only as a control fixture.
function runAuditTests(team,data,reference){
 const results=[];
 const test=(name,fn)=>{if(!fn())throw Error('AUDITORIA: '+name);results.push('✓ '+name)};
 const expected=(attack,defenders)=>defenders.reduce((n,t)=>n*reference.attackRows[attack][reference.types.indexOf(t)],1);
 const get=n=>team.find(p=>p.name===n),fact=n=>reference.moves[n];
 const actualMove=(owner,name,defenders)=>quickAttacks({...get(owner),moves:get(owner).moves.filter(m=>m[0]===name)},defenders,data).best;
 const defense=(type,p)=>{const n=expected(type,p.types);return type==='water'&&p.ability==='Water Absorb'?0:n>1&&p.ability==='Solid Rock'?n*.75:n};
 test('Auditoria: referência tem os 18 tipos e 324 valores explícitos',()=>reference.types.length===18&&new Set(reference.types).size===18&&reference.types.every(t=>reference.attackRows[t].length===18&&reference.attackRows[t].every(n=>[0,.5,1,2].includes(n))));
 reference.types.forEach((attack,i)=>reference.types.forEach((defender,j)=>test(`Matriz independente: ${attack} → ${defender} = ${reference.attackRows[attack][j]}×`,()=>effectiveness(attack,[defender])===reference.attackRows[attack][j])));
 reference.types.forEach(attack=>test(`Dupla tipagem independente: ${attack} contra as 306 combinações ordenadas`,()=>reference.types.every(a=>reference.types.filter(b=>a!==b).every(b=>effectiveness(attack,[a,b])===expected(attack,[a,b])&&effectiveness(attack,[b,a])===expected(attack,[a,b])))));
 test('Auditoria: mantém exatamente os seis integrantes confirmados',()=>team.length===6&&Object.keys(reference.roster).every(n=>team.some(p=>p.name===n)));
 team.forEach(p=>{
  test(`Moveset confirmado: ${p.name}`,()=>JSON.stringify(p.moves)===JSON.stringify(reference.roster[p.name]));
  p.moves.forEach(([name,type])=>test(`Movimento auditado: ${p.name} / ${name}`,()=>{
   const f=fact(name),current=data.confirmedMoveFacts[name];
   return !!f&&!!current&&(f.category==='status'?type===null:type===f.type)&&['power','accuracy','category'].every(k=>current[k]===f[k])&&(data.highPriority.includes(name)===f.highPriority)&&(!Object.hasOwn(f,'priority')||current.priority===f.priority);
  }));
 });
 test('Gligar: exatamente quatro golpes, Rock Tomb presente e Rock Smash/Sand Tomb/Slash ausentes',()=>get('Gligar').moves.length===4&&get('Gligar').moves.map(m=>m[0]).join('|')==='Quick Attack|Acrobatics|Rock Tomb|Knock Off'&&!get('Gligar').moves.some(m=>['Rock Smash','Sand Tomb','Slash'].includes(m[0])));
 const required=[['Rock Smash','normal',2],['Rock Smash','electric',1],['Rock Smash','ghost',0],['Rock Tomb','normal',1],['Rock Tomb','electric',1],['Rock Tomb','flying',2],['Rock Tomb','fire',2],['Rock Tomb','ice',2],['Rock Tomb','bug',2],['Rock Tomb','rock',1],['Rock Tomb','fighting',.5],['Rock Tomb','ground',.5],['Rock Tomb','steel',.5],['Shadow Sneak','psychic',2],['Shadow Sneak','normal',0],['Magical Leaf','water',2],['Magical Leaf','ground',2],['Crunch','ghost',2],['Crunch','fairy',.5],['Acrobatics','fighting',2],['Acrobatics','electric',.5]];
 required.forEach(([name,type,value])=>test(`Obrigatório: ${name} → ${type} = ${value}×`,()=>{
  if(name==='Rock Smash')return effectiveness(fact(name).type,[type])===value; // Control only; not in the confirmed team.
  const owner=team.find(p=>p.moves.some(m=>m[0]===name));return actualMove(owner.name,name,[type]).multiplier===value;
 }));
 test('Obrigatório: Kirlia recebe Sombrio 1×',()=>damageTaken('dark',get('Kirlia'))===1);
 test('Obrigatório: Gligar recebe Elétrico 0×',()=>damageTaken('electric',get('Gligar'))===0);
 test('Obrigatório: Lapras Water Absorb recebe Água 0×',()=>damageTaken('water',get('Lapras'))===0);
 test('STAB separado: Rock Tomb de Gligar é 1× de STAB; Acrobatics tem STAB',()=>!actualMove('Gligar','Rock Tomb',['normal']).stab&&actualMove('Gligar','Rock Tomb',['normal']).multiplier===1&&actualMove('Gligar','Acrobatics',['fighting']).stab&&actualMove('Gligar','Acrobatics',['fighting']).multiplier===2);
 test('STAB separado: Shadow Sneak continua 2× contra Psíquico, sem embutir 1,5×',()=>actualMove('Honedge','Shadow Sneak',['psychic']).multiplier===2&&actualMove('Honedge','Shadow Sneak',['psychic']).stab);
 test('Tipo do atacante não substitui o tipo do golpe',()=>{const p=get('Gligar'),altered={...p,types:['water']};return quickAttacks(altered,['electric'],data).best.multiplier===1&&doubleMove(altered,p.moves.find(m=>m[0]==='Rock Tomb'),['normal','electric'],data).effectiveness.join()==='1,1'});
 test('Rock Smash: as cinco vantagens exatas; nenhuma contra Elétrico',()=>reference.types.filter(t=>effectiveness(fact('Rock Smash').type,[t])>1).sort().join()==='dark,ice,normal,rock,steel');
 test('Rock Tomb atual: as quatro vantagens exatas, pelo tipo registrado',()=>reference.types.filter(t=>actualMove('Gligar','Rock Tomb',[t]).multiplier>1).sort().join()==='bug,fire,flying,ice');
 test('Rock Tomb: 4× contra Fogo/Voador, 1× contra Normal/Elétrico e Normal/Fantasma',()=>actualMove('Gligar','Rock Tomb',['fire','flying']).multiplier===4&&actualMove('Gligar','Rock Tomb',['normal','electric']).multiplier===1&&actualMove('Gligar','Rock Tomb',['normal','ghost']).multiplier===1);
 test('Movimentos: todos os ataques atuais contra os 18 tipos coincidem com a referência',()=>team.every(p=>p.moves.filter(m=>m[1]).every(([name])=>reference.types.every(t=>actualMove(p.name,name,[t]).multiplier===expected(fact(name).type,[t])))));
 test('Movimentos: todos os ataques atuais contra 153 duplas tipagens coincidem com a referência',()=>team.every(p=>p.moves.filter(m=>m[1]).every(([name])=>reference.types.every((a,i)=>reference.types.slice(i+1).every(b=>actualMove(p.name,name,[a,b]).multiplier===expected(fact(name).type,[a,b]))))));
 test('Defesa: todos os seis integrantes contra os 18 ataques, com habilidades separadas',()=>team.every(p=>reference.types.every(t=>damageTaken(t,p)===defense(t,p))));
 test('Habilidade: Water Absorb muda só Água; Solid Rock não cria imunidade',()=>reference.types.every(t=>defensiveEffectiveness(t,get('Lapras'))===(t==='water'?0:expected(t,get('Lapras').types)))&&damageTaken('grass',get('Tirtouga'))===3&&effectiveness('grass',get('Tirtouga').types)===4);
 test('Prioridade: +1 sustentada e Fake Out +3 condicional nos dois motores',()=>[['Honedge','Shadow Sneak'],['Gligar','Quick Attack'],['Tirtouga','Aqua Jet'],['Lapras','Ice Shard']].every(([owner,name])=>actualMove(owner,name,['psychic']).priority&&doubleMove(get(owner),get(owner).moves.find(m=>m[0]===name),['psychic','water'],data).priority&&data.confirmedMoveFacts[name].priority===1)&&data.confirmedMoveFacts['Fake Out'].priority===3&&actualMove('Torracat','Fake Out',['normal']).conditional&&doubleMove(get('Torracat'),['Fake Out','normal'],['normal','water'],data).conditional);
 test('Precisão: — permanece literal, nunca 0% nem 100%',()=>['Aerial Ace','Magical Leaf','Heal Pulse','Swords Dance','Protect','Double Team'].every(n=>data.confirmedMoveFacts[n].accuracy==='—'));
 test('Categoria: Ancient Power usa SpA 53 de Tirtouga; Crunch usa Ataque 78',()=>doubleMove(get('Tirtouga'),['Ancient Power','rock'],['fire','flying'],data).offenseBase===53&&doubleMove(get('Tirtouga'),['Crunch','dark'],['ghost','psychic'],data).offenseBase===78);
 test('Efeitos: Acrobatics, Knock Off e Pursuit não recebem bônus condicionais presumidos',()=>[['Gligar','Acrobatics',55],['Gligar','Knock Off',65],['Honedge','Pursuit',40]].every(([owner,name,power])=>doubleMove(get(owner),get(owner).moves.find(m=>m[0]===name),['normal','electric'],data).power===power));
 test('Suporte: Heal Pulse não é recuperação própria; Protect não protege parceiro; setup não aplicado',()=>{const r=doubleEvaluate([get('Kirlia'),get('Tirtouga')],['water','normal'],data);return data.confirmedMoveFacts['Heal Pulse'].selfRecovery===false&&r.support.some(n=>n.kind==='heal-ally'&&n.text.includes('Tirtouga')&&n.text.includes('Não cura o próprio'))&&r.support.some(n=>n.kind==='protect'&&n.text.includes('Não protege diretamente'))&&data.confirmedMoveFacts['Swords Dance'].attackStages===2});
 test('Parting Shot: alcance permanece desconhecido e não é propagado como efeito de área',()=>data.doublesMechanics['Parting Shot'].target==='unknown'&&data.doublesMechanics['Parting Shot'].targetVerified===false);
 for(const type of reference.types){
  test(`Individual auditado: ${type}, seis opções nos dois cenários e textos coerentes`,()=>{
   const r=quickRanking([type],team,data);
   return ['direct','free'].every(k=>r[k].length===6&&new Set(r[k].map(x=>x.pokemon.name)).size===6&&r[k].every(row=>{
    const attack=row.attacks.best,reason=quickReason(row,k);
    return row.received[0].multiplier===defense(type,row.pokemon)&&(!attack||(attack.multiplier===expected(fact(attack.name).type,[type])&&(attack.multiplier===0||reason.includes(`${attack.name}: ${quickFactor(attack.multiplier)}`))))&&reason.includes(k==='direct'?TYPES[type]:'Velocidade');
   }));
  });
 }
 test('Individual: Elétrico mantém Gligar imune e nenhuma resposta super efetiva',()=>quickRanking(['electric'],team,data).direct[0].pokemon.name==='Gligar'&&offensiveOptions('electric',team).length===0);
 test('Duplas: Rock Tomb é neutro contra Normal e Elétrico separados, sem STAB',()=>{const tuple=get('Gligar').moves.find(m=>m[0]==='Rock Tomb'),m=doubleMove(get('Gligar'),tuple,['normal','electric'],data);return m.effectiveness[0]===1&&m.effectiveness[1]===1&&!m.stab&&doubleActions(get('Gligar'),get('Lapras'),['normal','electric'],data).filter(a=>a.name==='Rock Tomb'&&a.targets[0]===1).every(a=>a.coverage[1]===1)});
 test('Duplas: 324 cenários, 15 pares, quatro defesas e uma ação por aliado com multiplicadores corretos',()=>reference.types.every(a=>reference.types.every(b=>{
  const types=[a,b],r=doubleAnalyze(types,team,data);
  return r.valid&&Object.values(r.rankings).every(list=>list.length===15)&&r.all.every(row=>{
   const offense=row.offense.actions;
   return row.matrix.every((cells,i)=>cells.every((cell,j)=>cell.multiplier===defense(types[j],row.pair[i])))&&offense.length===2&&offense.every((action,i)=>action.owner===row.pair[i].name&&action.targets.length<=1&&(!action.name||action.targets.every(target=>action.coverage[target]===expected(fact(action.name).type,[types[target]]))))&&['defensive','offensive','balanced'].every(k=>{const text=doublePairReason(row,types,k);return offense.every(action=>!action.name||text.includes(`${action.name} ${action.targets.map(target=>quickFactor(expected(fact(action.name).type,[types[target]]))).join('/')}`))});
  });
 })));
 test('Duplas: posições e custos corretos nos 4.860 pares ativos × cenários',()=>reference.types.every(a=>reference.types.every(b=>{
  const types=[a,b],r=doubleAnalyze(types,team,data);return doublePairs(team).every(active=>{const p=doublePosition(r.all,active,types);return p&&p.count===p.changed.filter(Boolean).length&&p.count===(p.pattern==='keep'?0:p.pattern==='swapBoth'?2:1)&&p.slots[0].name!==active[1].name&&p.slots[1].name!==active[0].name&&p.row.matrix.every((cells,i)=>cells.every((cell,j)=>cell.multiplier===defense(types[j],p.row.pair[i])))});
 })));
 test('Modos compartilham referência de fatos de movimento; não atribuem valores diferentes',()=>team.every(p=>p.moves.filter(m=>m[1]).every(([name,type])=>{const q=actualMove(p.name,name,['normal']),d=doubleMove(p,[name,type],['normal','electric'],data);return ['power','accuracy','category','priority'].every(k=>q.facts[k]===d.facts[k])&&q.multiplier===d.effectiveness[0]&&q.stab===d.stab})));
 test('Rock Tomb: dados específicos 60/95 físico e redução de Velocidade em um estágio',()=>{const f=data.confirmedMoveFacts['Rock Tomb'];return f.category==='physical'&&f.power===60&&f.accuracy===95&&f.speedStages===-1});
 test('Rankings: Rock Smash, Sand Tomb e Slash não aparecem em nenhum plano atual',()=>reference.types.every(t=>{const q=quickRanking([t],team,data),d=doubleAnalyze([t,'electric'],team,data),absent=m=>!['Rock Smash','Sand Tomb','Slash'].includes(m);return ['direct','free'].every(k=>q[k].every(r=>!r.attacks.best||absent(r.attacks.best.name)))&&d.all.every(r=>r.offense.actions.every(a=>absent(a.name)))}));
 return results;
}

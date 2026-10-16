'use strict';
function runIndividualActionTests(team,data){
 const tests=[],test=(name,fn)=>{if(!fn())throw Error(name);tests.push('✓ Individual: '+name)},has=(result,name)=>result.actions.some(a=>a.action===name),names=(result)=>result.actions.map(a=>a.key).join('|');
 const torr=individualActionRanking(['grass'],'Torracat',team,data,false);
 test('sem Fake Out não lista o golpe e mantém cursos distintos',()=>!has(torr,'Fake Out')&&new Set(torr.actions.map(a=>a.key)).size===torr.actions.length);
 const available=individualActionRanking(['grass'],'Torracat',team,data,true);
 test('Fake Out disponível pode entrar no ranking contextual',()=>has(available,'Fake Out')&&names(available)!==names(torr));
 test('Fake Out é removido do cenário indisponível',()=>!has(torr,'Fake Out'));
 test('Fantasma torna Fake Out irrelevante e ilegal no ranking',()=>{const r=individualActionRanking(['ghost'],'Torracat',team,data,true);return !r.fakeOutRelevant&&!has(r,'Fake Out')});
 const pivot=individualActionRanking(['water'],'Torracat',team,data,false);
 test('Parting Shot é reposicionamento distinto de atacar ou trocar',()=>pivot.actions.some(a=>a.type==='REPOSICIONAR'&&a.action==='Parting Shot')&&pivot.actions.every(a=>a.key!=='switch:Torracat'));
 const threatened=individualActionRanking(['steel'],'Kirlia',team,data,false);
 test('Calm Mind perde prioridade diante de fraqueza imediata',()=>!threatened.actions.slice(0,2).some(a=>a.action==='Calm Mind'));
 const safer=individualActionRanking(['fighting'],'Kirlia',team,data,false);
 test('Calm Mind pode competir em posição defensiva favorável',()=>safer.actions.some(a=>a.action==='Calm Mind'));
 test('troca convencional consome o turno e entrante não ataca',()=>{const a=threatened.actions.find(x=>x.type==='TROCAR');return !!a&&a.uncertainty.includes('consome a ação')&&a.uncertainty.includes('sem atacar')});
 const electricAdvice=staySwitchAdvice(['electric'],'Torracat',team,data);
 test('vantagem ofensiva não força veredito permanecer quando Gligar é imune',()=>electricAdvice.decision==='ALTERNATIVA MAIS RESISTENTE'&&electricAdvice.alternative.pokemon.name==='Gligar'&&!electricAdvice.reason.includes('melhor jogada'));
 const fullOptions=individualActionRanking(['electric'],'Torracat',team,data,false).actions;
 test('opções ficam agrupadas por função e incluem mais que três ações',()=>{const firstSwitch=fullOptions.findIndex(a=>a.kind==='switch'),lastAttack=fullOptions.reduce((last,a,i)=>a.kind==='stay'?i:last,-1);return fullOptions.length>3&&firstSwitch>lastAttack});
 test('imunidade gera fato de tipo, não recomendação absoluta de permanecer',()=>{const r=staySwitchAdvice(['electric'],'Gligar',team,data);return r.decision==='IMUNIDADE POR TIPO'&&!r.decision.includes('PERMANECER')});
 test('interface isolada de duplas continua disponível',()=>typeof doubleAnalyze==='function'&&typeof doubleTurnPlan==='function');
 return tests;
}

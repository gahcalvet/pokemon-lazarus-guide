// Multiplicadores por tipo. Ausência de entrada = dano neutro.
const TYPES = {normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Veneno',ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',steel:'Aço',fairy:'Fada'};
const CHART = {
 normal:{rock:.5,ghost:0,steel:.5},
 fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
 water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},
 electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
 grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
 ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
 fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
 poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},
 ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
 flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},
 psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
 bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
 rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},
 ghost:{normal:0,psychic:2,ghost:2,dark:.5},
 dragon:{dragon:2,steel:.5,fairy:0},
 dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
 steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
 fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
};
function effectiveness(attack,defenders){return defenders.reduce((n,t)=>n*(CHART[attack]?.[t]??1),1)}
function defensiveEffectiveness(attack,pokemon){return (attack==='water'&&pokemon.ability==='Water Absorb')||(attack==='electric'&&pokemon.ability==='Volt Absorb')?0:effectiveness(attack,pokemon.types)}
function damageTaken(attack,pokemon){const n=defensiveEffectiveness(attack,pokemon);return n>1&&pokemon.ability==='Solid Rock'?n*.75:n}
function offensiveOptionsAgainst(defenders,team){return team.flatMap(p=>p.moves.filter(m=>m[1]&&effectiveness(m[1],defenders)>1).map(m=>({pokemon:p.name,move:m[0],type:m[1],multiplier:effectiveness(m[1],defenders)})))}
function offensiveOptions(type,team){return offensiveOptionsAgainst([type],team)}
function toggleTypeSelection(current,type){if(type==='all')return [];if(current.includes(type))return current.filter(t=>t!==type);return current.length<2?[...current,type]:current}
if(typeof module!=='undefined')module.exports={TYPES,CHART,effectiveness,defensiveEffectiveness,damageTaken,offensiveOptions,offensiveOptionsAgainst,toggleTypeSelection};

# Lazarus · Guia de batalha

Guia estático de trocas para a equipe atual de Pokémon Lazarus 2.0.

Site: https://gahcalvet.github.io/pokemon-lazarus-guide/

## Atualizações

Edite `team.json` para registrar apenas alterações confirmadas na equipe. Cada movimento usa `[nome, tipo]`; movimentos de suporte usam `null`. A interface recalcula defesa e resposta ofensiva automaticamente. `care.json` preserva os cuidados estratégicos fornecidos, com correções de cálculo documentadas abaixo.

`types.js` contém a tabela de efetividade, separada da interface (`app.js` e `styles.css`). Os 18 ícones em `icons.js` foram recortados individualmente da referência fornecida e incorporados como PNGs, sem dependências externas.

## Precisão

- Kirlia recebe dano neutro de Sombrio (Psíquico/Fada).
- Tirtouga e Gligar recebem dano neutro de Pedra; Honedge resiste ao tipo.
- Tirtouga tem fraqueza 4× a Planta por tipos; Solid Rock resulta em 3× de dano.
- Nenhum movimento futuro é considerado. Lapras possui Water Absorb confirmado: imunidade a Água por habilidade e recuperação de HP; a tipagem Água/Gelo sozinha resiste ½×.
- Multiplicadores não garantem trocas seguras nem incorporam HP, atributos, itens ou cobertura adversária.

## Verificação

Abra `tests.html` no navegador para executar os testes de tipos e movimentos. Para desenvolvimento, sirva esta pasta com um servidor HTTP estático. A publicação usa GitHub Pages, branch `main`, pasta raiz.

## Design · segunda edição

Referências: Linear (https://linear.app/) para hierarquia e superfícies escuras; Living Pokédex Tracker (https://stephaniecervi.design/web-design/web-applications/living-pokedex-tracker/) para identificação visual do sexteto e adaptação ao celular. A identidade própria segue a ideia de um caderno de campo.

Indicadores: 0× verde / imune; ¼× violeta / resiste muito; ½× azul / resiste. Todos mantêm o multiplicador textual. Os cuidados em `care.json` têm título e explicação, sem mudar a equipe.

As ilustrações da equipe são carregadas como arquivos estáticos do repositório público PokeAPI/sprites; os ícones de tipos permanecem incorporados localmente. Nenhuma API paga é usada.

## Dupla tipagem · terceira edição

Selecione até dois tipos e desmarque clicando novamente; “Todos os tipos” limpa a seleção. Com dois tipos, as respostas ofensivas usam o produto dos dois multiplicadores. A defesa permanece separada por tipo de ataque, pois um Pokémon de dois tipos não combina esses tipos em um único golpe. A busca filtra linhas sem alterar a combinação selecionada; escolher um tipo limpa a busca.

O grid de fundo usa uma máscara radial para desaparecer nas bordas; não intercepta cliques. A Pokébola fica alinhada e sem a contagem de parceiros/tipos.


## Modo rápido inteligente

`ranking.js` deriva os dois rankings de `team.json`, da tabela existente e de `battle-data.json` (referência por espécie, extraída da planilha de Nemo622 em 14/10/2026). Não há segunda equipe nem rankings escritos manualmente. Não altera o cálculo da tabela existente. Seleção vazia mostra uma instrução; um ou dois tipos mostram cartões e rankings recolhidos.

Critérios lexicográficos, sem soma ponderada: defesa pelo pior multiplicador, depois pelo segundo, recuperação por Water Absorb, camadas de dominância conjunta de HP/Def/SpD, Intimidate/Parting Shot e resposta ofensiva. Entrada livre por efetividade, STAB, prioridade sustentada, velocidade base, setup e pivot em empate. Golpes condicionais não ganham bônus; os boosts de setup não são aplicados. Empates completos são explícitos.

Na leitura do Pokémon ativo, o sinal agora descreve vantagens e riscos por tipo; não escolhe permanecer ou trocar sem HP e movimentos adversários. Ataques, trocas e ações táticas ficam em grupos separados porque seus critérios não formam uma pontuação comparável. A ordem dos ataques usa efetividade × STAB × poder-base, não dano calculado.

Limite conhecido: poder, precisão e categoria dos golpes não foram confirmados na fonte específica e ficam fora dos desempates; não inferir Ataque versus Ataque Especial sem categoria. Não prevê dano, ordem individual, EVs, itens, HP atual, cobertura ou habilidade adversária. Bases modificadas verificadas incluem Gligar 75/75/105/35/70/60 e Lapras 130/75/80/95/95/60. Falha na referência do modo rápido preserva o guia original. Novas espécies consultam o catálogo por nome; dados e efeitos novos não verificados são sinalizados, sem valores inventados. Atualizar a referência verificada quando houver nova versão do jogo.


## Atualização confirmada · 14/10/2026

Kirlia substitui Ralts, com Synchronize e os quatro movimentos preservados. Bases do Lazarus: 38/35/35/65/55/50. Honedge recebe Shadow Sneak e Aerial Ace; Gligar recebe Acrobatics e Rock Tomb (retificação do jogador em 15/10/2026); Tirtouga recebe Crunch. Torracat e Lapras permanecem intactos. Nenhum item foi presumido. Fatos parciais de golpes confirmados pelo jogador estão no catálogo; não são usados para inventar comparações de poder com golpes ainda não verificados. Acrobatics não recebe bônus presumido. A inscrição fixa de nível 19 foi retirada: não há confirmação do nível atual de todos os integrantes.


## Modo duplas (15/10/2026)

A alternância preserva o modo individual e suas seleções. Os dois tipos de duplas representam adversários separados A/B; podem ser iguais. Slots aliados são opcionais, mas não podem repetir integrantes. Sem aliados são avaliados os 15 pares; um aliado fixa cinco parceiros; dois habilitam análise de manutenção e trocas, respeitando as ações consumidas.

`doubles.js` utiliza a equipe compartilhada, `types.js` e `battle-data.json`. Defesa considera quatro cruzamentos e habilidades confirmadas. Ofensiva atribui uma ação por aliado: efetividade, potencial estrutural de poder × STAB × base ofensiva × efetividade, precisão separada, prioridade sustentada e velocidade base. Potencial não é previsão de dano. Equilíbrio usa dominância/Pareto e critérios ordenados, com exposição máxima antes de utilidade nos desempates. Sem notas somadas.

Os 23 movimentos atuais têm poder, categoria e precisão confirmados pelo jogador via Pokédex Lazarus / ROM Hack Guides. Precisão `—` é literal; bypass e ausência de teste de status são distintos de 100%. Ancient Power usa SpA. Heal Pulse só cura outro alvo. Protect é individual. Acrobatics só dobra se `item: null` for explicitamente confirmado; campo ausente significa desconhecido. Knock Off, Pursuit, Fake Out e boosts têm condições não presumidas.

Parting Shot permanece com alcance desconhecido: o texto de ROM Hack Guides cita os alvos afetados sem fornecer o targeting em duplas. Nenhum benefício de atingir ambos é atribuído. A equipe não possui ataque de área confirmado. Há suporte e testes de infraestrutura para alvos `selected-opponent`, `both-opponents`, `all-others`, `ally`, `self` e `unknown`; dano aliado não é ignorado. Fixtures não acrescentam movimentos à equipe.

Validação: abrir `tests.html` no site. Os testes originais são preservados e `doubles-tests.js` acrescenta pares, matriz 2×2, dados de movimentos, ações, suporte, área, slots, trocas, imutabilidade e as 324 combinações A/B. Layout e interação também devem ser conferidos no Chrome em desktop e largura de 390px antes da publicação.


## Retificação e auditoria · 15/10/2026

A confirmação mais recente do jogador corrige o registro do Gligar: Quick Attack, Acrobatics, **Rock Tomb**, Knock Off. Rock Smash estava registrado por informação anterior incorreta e foi substituído exclusivamente por Rock Tomb, Pedra, físico, poder 60 e precisão 95, sem STAB. Sand Tomb e Slash foram recusados. A matriz e os algoritmos são preservados; a cobertura é recalculada pela equipe compartilhada. O cuidado sobre Sombrio foi corrigido para remover a referência ao golpe Lutador ausente. Consulte [o relatório da auditoria](AUDITORIA.md) e execute [os testes](tests.html).

## Dreamstone Mysteries

`dreamstone-team.json` registra a equipe atual confirmada: Gyarados (32, Adamant, Intimidate, Life Orb), Meganium (39, Bold, Overgrow, Leftovers), Quilava (34, Timid, Blaze, Charcoal), Gardevoir (32, Calm, Trace, Wise Glasses), Lanturn (32, Modest, Volt Absorb, Leftovers) e Linoone (35, Jolly, Gluttony, Life Orb), com os quatro golpes fornecidos pelo jogador. O progresso confirmado é Pelluca City, ginásio ainda não enfrentado, quest do prefeito aceita.

`dreamstone-battle-data.json` mantém dados específicos da ROM separados de Lazarus. Tipos, bases e golpes foram conferidos no código-fonte da [versão final Dreamstone Mysteries](https://github.com/dsmyst/dreamstone-mysteries/tree/release), tag `release`, commit `edd19c8`. O ranking reconhece Water Absorb e Volt Absorb, mas não simula dano real, HP, natureza, item ou clima atual. Status, recuperação e setup aparecem como opções condicionais; não são tratados como dano. Em duplas, Dazzling Gleam atinge os dois oponentes e Discharge todos os demais Pokémon, inclusive o parceiro; ataques que causariam dano ao aliado não são propostos como ações seguras.

Linoone permanece Dark/Normal conforme o registro confirmado pelo jogador; o código da ROM lista a espécie padrão como Normal, e a forma/tipagem da captura não pôde ser reconciliada. O perfil mostra níveis, naturezas, habilidades, itens, golpes e progresso. Os modos individual e duplas usam o perfil ativo. Abra `tests.html` para as verificações Lazarus e Dreamstone.

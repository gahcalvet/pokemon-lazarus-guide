# Retificação de Gligar e auditoria de precisão — Lazarus 2.0

Data: 15/10/2026. Base publicada inspecionada: `2097500d7e2b32ebcdb96229191f9e252be9e103`. A confirmação mais recente do jogador substitui os registros anteriores.

## Problema confirmado e causa

**Rock Smash estava realmente registrado no moveset do Gligar. O movimento confirmado pelo jogador é Rock Tomb, aprendido pela TM39.** O problema confirmado foi a entrada incorreta transmitida anteriormente ao projeto, não a matriz de tipos.

O registro incorreto fazia o guia atribuir a Gligar cobertura de Lutador contra Normal, Pedra, Sombrio e Aço, além de Gelo. A substituição por Rock Tomb retira essas quatro coberturas, mantém Gelo e acrescenta Fogo, Voador e Inseto. A nota estática de Sombrio também dependia do golpe incorreto e foi corrigida.

A indicação específica de Rock Smash 2× contra **Elétrico simples** não foi reproduzida no cálculo: Lutador→Elétrico já era 1×. Não foi atribuída causa sem evidência ao episódio relatado. A informação posterior do jogador esclareceu qual era o erro confirmado de moveset.

## Correção aplicada

Gligar mantém Terra/Voador, Hyper Cutter e exatamente quatro movimentos:

1. Quick Attack
2. Acrobatics
3. **Rock Tomb**
4. Knock Off

Foi substituído somente o par `Rock Smash / fighting` por `Rock Tomb / rock` no moveset. Rock Smash, Sand Tomb e Slash estão ausentes. Os outros cinco Pokémon, habilidades, itens e evoluções foram preservados.

A referência específica de Lazarus consultada informa Rock Tomb como Pedra, físico, poder 60, precisão 95 e TM39. A redução de Velocidade do alvo em um estágio foi registrada como efeito quando aplicado, sem alterar por suposição a velocidade atual de um adversário desconhecido. Rock Tomb não recebe STAB de Gligar.

| Rock Tomb contra | Efetividade |
| --- | --- |
| Fogo, Gelo, Voador, Inseto | 2× |
| Lutador, Terra, Aço | ½× |
| Normal, Elétrico, Água, Planta, Veneno, Psíquico, Pedra, Fantasma, Dragão, Sombrio, Fada | 1× |

Nenhum tipo é naturalmente imune ao golpe. Contra Fogo/Voador resulta em 4×; contra Normal/Elétrico resulta em 1×. Em duplas, A Normal e B Elétrico são alvos separados e recebem 1× cada, sem STAB.

## Matriz e dados preservados

Os 324 confrontos simples coincidiram com a aba Type Chart da planilha do criador e com a referência geral da PokéAPI, sem divergências. As 5.508 interações de ataques com as 306 tipagens duplas ordenadas da planilha também coincidiram. Colunas da planilha são ataques; linhas são defesas.

A eficácia ofensiva usa o tipo do golpe; STAB é separado. A imunidade defensiva de Gligar a Elétrico não torna Rock Tomb um golpe de Terra. Habilidades confirmadas continuam sendo tratadas separadamente, incluindo Water Absorb e Solid Rock.

Os dois modos continuam usando o mesmo `team.json`, `battle-data.json` e `types.js`. A referência independente de testes não participa dos rankings. A matriz e os algoritmos não foram reescritos; as recomendações mudam automaticamente a partir do moveset corrigido.

## Movimentos atuais conferidos

24 slots, com 23 movimentos distintos. Tipos de suporte abaixo são os tipos reais de referência; `null` no moveset é a convenção existente para não tratar suporte como ataque de dano. Este quadro não é uma segunda fonte operacional.

| Movimento | Tipo | Categoria | Poder | Precisão | Prioridade verificada |
| --- | --- | --- | --- | --- | --- |
| Acrobatics | Voador | Físico | 55 | 100 | Sem bônus considerado¹ |
| Aerial Ace | Voador | Físico | 60 | — | Sem bônus considerado¹ |
| Ancient Power | Pedra | Especial | 60 | 100 | Sem bônus considerado¹ |
| Aqua Jet | Água | Físico | 40 | 100 | +1 |
| Body Slam | Normal | Físico | 85 | 100 | Sem bônus considerado¹ |
| Confuse Ray | Fantasma | Status | — | 100 | Sem bônus considerado¹ |
| Confusion | Psíquico | Especial | 50 | 100 | Sem bônus considerado¹ |
| Crunch | Sombrio | Físico | 80 | 100 | Sem bônus considerado¹ |
| Double Team | Normal | Status | — | — | Sem bônus considerado¹ |
| Fake Out | Normal | Físico | 40 | 100 | +3 |
| Fire Fang | Fogo | Físico | 65 | 95 | Sem bônus considerado¹ |
| Heal Pulse | Psíquico | Status | — | — | Sem bônus considerado¹ |
| Ice Shard | Gelo | Físico | 40 | 100 | +1 |
| Knock Off | Sombrio | Físico | 65 | 100 | Sem bônus considerado¹ |
| Magical Leaf | Planta | Especial | 60 | — | Sem bônus considerado¹ |
| Parting Shot | Sombrio | Status | — | 100 | Sem bônus considerado¹ |
| Protect | Normal | Status | — | — | Alta; patamar não confirmado |
| Pursuit | Sombrio | Físico | 40 | 100 | Sem bônus considerado¹ |
| Quick Attack | Normal | Físico | 40 | 100 | +1 |
| Rock Tomb | Pedra | Físico | 60 | 95 | Sem bônus considerado¹ |
| Shadow Sneak | Fantasma | Físico | 40 | 100 | +1 |
| Swords Dance | Normal | Status | — | — | Sem bônus considerado¹ |
| Water Pulse | Água | Especial | 60 | 100 | Sem bônus considerado¹ |

¹ A documentação consultada não explicita o patamar numérico de todos os movimentos; isso não foi convertido em “0 confirmado”. Prioridades +1 e +3 fornecidas pelo jogador foram mantidas e testadas. Protect pertence ao grupo de alta prioridade da planilha; não foi inventado patamar numérico nem usado como ataque ofensivo.

Heal Pulse permanece cura de outro alvo, nunca recuperação própria de Kirlia; Protect protege o usuário; Swords Dance exige uma ação e não cria boost presumido; Fake Out depende do primeiro turno em campo. Bônus de Knock Off, Pursuit e Acrobatics não são presumidos. Ancient Power usa Ataque Especial. Precisão “—” permanece literal e distinta de porcentagem convencional. Efeitos secundários aleatórios não são tratados como garantidos.

## Testes executados

**548 testes passaram; zero falhas na versão corrigida.** A suíte anterior permanece, com as três afirmações específicas do moveset retificadas. Foram acrescentadas verificações independentes da auditoria e os casos obrigatórios de Rock Tomb.

- 324 confrontos simples individualizados contra valores de referência externos ao calculador.
- 5.508 combinações de ataque contra dupla tipagem, agrupadas em 18 testes.
- Os seis movesets, 24 slots, ausência de Rock Smash/Sand Tomb/Slash no Gligar e seus quatro golpes exatos.
- Os dez confrontos obrigatórios de Rock Tomb e seu STAB ausente em Gligar; controles de Rock Smash continuam existindo somente em testes, sem adicioná-lo à equipe.
- Todos os ataques atuais contra os 18 tipos e 153 duplas tipagens únicas; imunidades naturais e por habilidade; STAB e prioridade separados.
- Shadow Sneak contra Psíquico/Normal, Magical Leaf contra Água/Terra, Crunch contra Fantasma/Fada, Acrobatics contra Lutador/Elétrico, Kirlia recebendo Sombrio, Gligar recebendo Elétrico e Lapras absorvendo Água.
- Seis opções individuais nos dois cenários para os 18 tipos; três rankings de 15 pares nos 324 cenários de duplas e justificativas com multiplicadores coerentes.
- 4.860 casos de posicionamento: 15 pares ativos × 324 cenários, respeitando custo das trocas e slots.
- Categoria física/especial, precisão “—”, suporte, bônus condicionais, dados compartilhados e imutabilidade.

Testes deliberadamente incorretos foram executados em cópias em memória, sem editar a aplicação: Lutador→Elétrico 2× foi rejeitado, assim como trocar o tipo de Rock Tomb para Terra ou restaurar Rock Smash ao moveset confirmado. Essas falhas esperadas servem para verificar a capacidade da suíte de detectar regressões.

## Informação não verificada

O alcance de Parting Shot em duplas permanece não confirmado; nenhum bônus por afetar ambos foi aplicado. Patamares numéricos de prioridade não explicitados e probabilidades de efeitos secundários não foram inventados. A comparação com documentação e código não equivale à execução de todos os comportamentos do binário da ROM.

## Arquivos alterados

- `team.json`: substituição exclusiva do movimento do Gligar.
- `battle-data.json`: metadados verificados de Rock Tomb; demais movimentos preservados.
- `care.json`: correção da referência ofensiva antiga contra Sombrio.
- `app.js` e `index.html`: somente versões de cache para carregar os arquivos corrigidos.
- `tests.html`, `doubles-tests.js`, `audit-tests.js`, `audit-reference.json`: atualização do moveset esperado, casos obrigatórios e auditoria independente.
- `README.md` e `AUDITORIA.md`: retificação e relatório.

`types.js`, `ranking.js`, `doubles.js`, `doubles-ui.js`, `styles.css` e `icons.js` são preservados. Não foi implementada a segunda tipagem dos adversários em duplas.

## Publicação e conferência

O endereço continua [o mesmo GitHub Pages](https://gahcalvet.github.io/pokemon-lazarus-guide/). Antes de publicar, a conferência no Chrome deve confirmar Rock Tomb nos movimentos e nos dois modos; a publicação só é considerada concluída após verificar o deployment e os testes no endereço público. O resultado efetivo é comunicado ao jogador após essas verificações.

## Fontes

- [Planilha do criador de Lazarus](https://docs.google.com/spreadsheets/d/1pMw7DLrgIBFWEvCF1pXOEhAl5ksrGZQbS4wasJr7K-Y/edit): Type Chart e grupos de movimentos. Assinatura da cópia consultada em `audit-reference.json`.
- [ROM Hack Guides — Rock Tomb em Lazarus](https://romhackguides.com/hacks/lazarus/moves/#rock-tomb): Pedra, físico, 60/95, efeito de Velocidade e TM39.
- [PokéAPI — eficácia de tipos](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/type_efficacy.csv): conferência independente geral, sem substituir dados específicos da ROM.
- Retificação explícita mais recente do jogador em 15/10/2026: Gligar com Rock Tomb, não Rock Smash; Sand Tomb e Slash recusados.

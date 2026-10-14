# Lazarus · Guia de batalha

Guia estático de trocas para a equipe atual de Pokémon Lazarus 2.0.

Site: https://gahcalvet.github.io/pokemon-lazarus-guide/

## Atualizações

Edite `team.json` para registrar apenas alterações confirmadas na equipe. Cada movimento usa `[nome, tipo]`; movimentos de suporte usam `null`. A interface recalcula defesa e resposta ofensiva automaticamente. `care.json` preserva os cuidados estratégicos fornecidos, com correções de cálculo documentadas abaixo.

`types.js` contém a tabela de efetividade, separada da interface (`app.js` e `styles.css`). Os 18 ícones em `icons.js` foram recortados individualmente da referência fornecida e incorporados como PNGs, sem dependências externas.

## Precisão

- Ralts recebe dano neutro de Sombrio (Psíquico/Fada).
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

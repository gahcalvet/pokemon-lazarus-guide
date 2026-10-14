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
- Nenhum movimento futuro é considerado. Lapras permanece com Shell Armor.
- Multiplicadores não garantem trocas seguras nem incorporam HP, atributos, itens ou cobertura adversária.

## Verificação

Abra `tests.html` no navegador para executar os testes de tipos e movimentos. Para desenvolvimento, sirva esta pasta com um servidor HTTP estático. A publicação usa GitHub Pages, branch `main`, pasta raiz.

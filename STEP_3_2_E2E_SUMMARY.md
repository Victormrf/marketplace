# Etapa 3.2 — Testes E2E de jornadas críticas

## Resultado

Foi adicionada uma suíte Playwright reproduzível que percorre navegador, Next BFF,
backend Express e PostgreSQL exclusivo. Execução serial, com fixtures próprias,
limpeza conferida no final de cada teste, screenshots e traces em falhas.

## Execução

Pré-requisitos, comandos, isolamento, fixtures, relatórios e recuperação após
interrupção estão centralizados no [README E2E](nextjs-frontend/e2e/README.md).

## Evidências

Após as correções, as duas execuções completas tiveram 12/12 testes aprovados
cada. A repetição ocorreu após a limpeza das fixtures de cada cenário.

- Auth: login válido CUSTOMER/SELLER, cookie HttpOnly, refresh, logout,
  credenciais inválidas e acesso protegido sem sessão.
- Catálogo: busca, filtros combinados, contagem, paginação/URL e disponibilidade.
- Carrinho: inclusão, atualização, valores, estoque insuficiente sem mutação e
  remoção HTTP `204` confirmada com carrinho vazio.
- Checkout: endereço e snapshot, valores/itens, refresh e recuperação idempotente.
  O POST real foi encaminhado ao backend, seu 201 foi consumido, e a resposta
  somente então foi interrompida antes de chegar ao browser. O retry usou a mesma
  chave/endereço e recebeu replay 200 para o mesmo pedido, sem reservas extras.
- Pagamento: criação integral pela UI; callback do provider simulado executado
  via métodos internos existentes; após refresh, GET do pedido e da lista de
  PaymentAttempts retornam `200`, incluindo `CAPTURED`. O banco confirma Order
  `CONFIRMED`, um único PaymentAttempt e um histórico de confirmação, sem endpoint
  público de captura ou sucesso fictício na interface.
- Seller: produtos e inventário, reposição, bloqueio de outro seller e transição
  permitida de SellerOrder.
- Segurança: guard rejeita marketplace_dev, host externo, porta divergente e
  parâmetros extras; teste de segurança passou. Typecheck e build passaram.
- Proxy Next: 13/13 testes; corpo DELETE vazio encaminhado sem Content-Type,
  corpo não suportado rejeitado com 415 e JSON inválido com 400.
- Duas execuções E2E completas: 12/12 em cada rodada.

## Diagnóstico das pendências

- DELETE vazio: o stream do request podia existir mesmo sem bytes. O proxy agora
  verifica se há conteúdo antes de exigir Content-Type, sem descartar corpos
  DELETE não vazios; o E2E confirmou `204` e remoção persistida.
- Refresh do pagamento: a demora inicial foi observada durante o arranque e a
  compilação de rotas do Next dev. O cenário estabilizado passou nas duas
  rodadas; os GETs do pedido/tentativas foram `200` e o banco confirmou captura
  e pedido confirmado. Nenhum sleep, retry artificial ou aumento de timeout
  foi usado.
- A captura continua sendo simulada pelo fluxo interno existente do provider de
  desenvolvimento; não há endpoint HTTP público de captura.

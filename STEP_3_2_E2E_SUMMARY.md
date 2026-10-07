# Etapa 3.2 — Testes E2E de jornadas críticas

## Resultado

Foi adicionada uma suíte Playwright reproduzível que percorre navegador, Next BFF,
backend Express e PostgreSQL exclusivo. Execução serial, com fixtures próprias,
limpeza conferida no final de cada teste, screenshots e traces em falhas.

## Ambiente e comandos

Banco descartável em `127.0.0.1:5434/marketplace_e2e`, usuário
`marketplace_e2e`, executado em container Postgres 16 com filesystem em tmpfs.
Backend `127.0.0.1:8100`, Next `localhost:3100` e `.next-e2e`. A proteção
confere a URL completa permitida antes de importar Prisma ou executar migrations;
a identidade real de banco e usuário é verificada antes de cada limpeza.
Nenhum dado de `marketplace_dev`, seed ou produção foi usado.

No `nextjs-frontend`:

```sh
npx playwright install chromium
npm run e2e:prepare
npm run test:e2e
npm run test:e2e -- --grep "checkout: lost real response"
npm run e2e:report
npm run test:e2e:safety
```

`test:e2e` também prepara a infraestrutura, aplica somente a baseline existente,
compila o backend, inicia os servidores, aguarda disponibilidade e encerra-os.
O banco é reutilizado entre execuções, porém todas as tabelas de negócio são
limpas e verificadas para cada cenário. Um worker evita disputa entre fixtures.

## Evidências

As duas execuções completas tiveram 12 testes cada: 11 aprovados e 1 reprovado
em ambas. A repetição produziu os mesmos resultados após limpeza integral.

- Auth: login válido CUSTOMER/SELLER, cookie HttpOnly, refresh, logout,
  credenciais inválidas e acesso protegido sem sessão.
- Catálogo: busca, filtros combinados, contagem, paginação/URL e disponibilidade.
- Carrinho: inclusão, atualização, valores e estoque insuficiente sem mutação.
- Checkout: endereço e snapshot, valores/itens, refresh e recuperação idempotente.
  O POST real foi encaminhado ao backend, seu 201 foi consumido, e a resposta
  somente então foi interrompida antes de chegar ao browser. O retry usou a mesma
  chave/endereço e recebeu replay 200 para o mesmo pedido, sem reservas extras.
- Pagamento: criação integral pela UI; callback do provider simulado executado
  via métodos internos existentes; captura/Order confirmadas e persistidas após
  refresh, sem endpoint público ou sucesso fictício na interface.
- Seller: produtos e inventário, reposição, bloqueio de outro seller e transição
  permitida de SellerOrder.
- Segurança: guard rejeita marketplace_dev, host externo, porta divergente e
  parâmetros extras; 1 teste de segurança passou. Typecheck e build passaram;
  testes existentes de checkout (2), dashboard (6) e proxy (10) passaram.

## Pendência para fechar a etapa

O teste de remoção via interface falha consistentemente: backend espera `204`,
mas o Next BFF responde `415 Unsupported request content type` ao encaminhar o
DELETE sem corpo. A requisição não remove o item. O comportamento foi mantido
visível nas duas rodadas; a fase 3.2 permanece em andamento até corrigir e repetir
a suíte completa. A captura do pagamento é representada por callback interno do
simulador, pois não existe endpoint HTTP público para captura.

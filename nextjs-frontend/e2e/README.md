# Jornadas E2E — fase 3.2

## Execução

Pré-requisitos: Node compatível com o projeto, Docker Desktop ativo e dependências
instaladas com `npm ci` em `nodejs-backend` e `nextjs-frontend`. No frontend:

```sh
npx playwright install chromium
npm run e2e:prepare
npm run test:e2e
npm run test:e2e -- --grep "checkout: lost real response"
npm run e2e:report
```

`test:e2e` já prepara o ambiente: inicia PostgreSQL com healthcheck, aplica apenas
as migrations existentes, recompila o backend e inicia os dois servidores.
Playwright aguarda os servidores e os encerra ao terminar. Não precisa de MCP
nem de servidores iniciados manualmente. Portas ocupadas causam falha; sessões
e servidores existentes nunca são reaproveitados.

O relatório HTML fica em `playwright-report`; screenshots e traces de falhas
ficam em `test-results`. Esses diretórios são ignorados pelo Git. Não publique
traces sem revisão: podem conter cookies das sessões descartáveis.

## Ambiente autorizado

- PostgreSQL: `127.0.0.1:5434/marketplace_e2e`, usuário `marketplace_e2e`.
- Senha exclusivamente local do container: `e2e_local_only`.
- Backend: `http://127.0.0.1:8100`, JWT secret exclusivo de teste.
- Next/navegador: `http://localhost:3100`; `BACKEND_API_URL` é definido pelo runner.
- Next usa `.next-e2e`, separado do `.next` de desenvolvimento.

A guard verifica protocolo, host, porta, banco, usuário, senha e ausência de
parâmetros extras antes de migrations, import do Prisma ou preparação. Uma
`DATABASE_URL` herdada apontando ao desenvolvimento/produção é recusada: remova
essa variável da sessão para rodar a suíte. Antes de qualquer limpeza, também
são conferidos `current_database()` e `current_user` pela conexão real.
`npm run test:e2e:safety` comprova recusas de destinos não autorizados.

O container usa tmpfs e não monta o volume de desenvolvimento. A suíte limpa
somente o banco E2E e verifica todas as tabelas de negócio vazias após cada
cenário; a tabela de migrations é preservada. Para encerrar somente o serviço:

```sh
docker compose -f ../docker-compose.e2e.yml stop postgres-e2e
```

Não use `--remove-orphans`: o compose de desenvolvimento pode estar ativo.

## Fixtures e isolamento

Um worker, sem retries automáticos, inicialmente. Cada teste recria três users
(customer e dois sellers), dois perfis seller, um customer, cinco produtos
identificáveis `E2E Book`, estoques próprios, dois endereços e um SellerOrder
`PENDING` cujo pai está `CONFIRMED`. IDs, preços e ordenação são determinísticos;
nenhum cenário depende do seed ou do teste anterior. Contextos do navegador
são descartáveis e não há storageState versionado.

Os testes não suportam dois runners simultâneos contra o mesmo banco exclusivo.
A paralelização com bancos por worker fica para evolução posterior.

## Casos e limites

- Auth: customer/seller, credenciais inválidas, cookie HttpOnly, refresh,
  logout e redirecionamento de `/profile` sem sessão.
- Catálogo: filtros combinados reais, contagem/paginação/URL e disponibilidade.
- Carrinho: inclusão/quantidade/totais/remoção/persistência; estoque muda após
  a leitura para comprovar recusa real com 409 e carrinho inalterado.
- Checkout: snapshot de endereço, itens/centavos, persistência; `route.fetch()`
  encaminha o POST real, aguarda 201 e só então `route.abort()` perde a entrega
  ao navegador. Refresh/retry preserva chave/endereço e recebe 200/replay.
- Pagamento: UI cria a tentativa integral real `CREATED` e não inventa captura.
  O helper de teste entrega eventos internos existentes (`startProcessing`,
  `authorize`, `capture`) como callback do simulador. A UI consulta `CAPTURED`
  e `CONFIRMED`, mantém persistência e impede nova cobrança. Não existe endpoint
  público de captura; isto não comprova integração com gateway externo.
- Seller: lista própria, reposição e transição de SellerOrder pela UI; outro
  seller não vê o produto e a tentativa suplementar via fetch do navegador
  recebe recusa real ao editar recurso alheio.

Não são testes de carga nem substituem concorrência/atomicidade do backend.
Os GETs de perfil são usados para aguardar identidade após login; as ações
de negócio testadas passam pelos componentes reais, services e BFF.

Referências: [fixtures Playwright](https://playwright.dev/docs/test-fixtures) e
[interceptação com Route](https://playwright.dev/docs/api/class-route).

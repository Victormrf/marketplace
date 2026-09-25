# Fase 2.1 — mapa de migração do frontend

## Revisão da decisão arquitetural — 24/09/2026

A implementação simplifica a proposta inicial para um único caminho principal:

```text
Componente → hook opcional → service por domínio → lib/http.ts → app/api → backend
```

- `lib/http.ts` concentra fetch, JSON, resposta `204`, `ApiError` com status e `no-store` nas chamadas do navegador. Services usam exclusivamente rotas `/api` de mesma origem.
- `services/auth.ts`, `user.ts`, `customer.ts` e `seller.ts` nomeiam operações do domínio. Não criar hooks pass-through; um hook só é justificável quando controlar estado ou interação útil da tela.
- `app/api` permanece como BFF de allowlist fixa: o navegador não escolhe URL de destino; o Route Handler encaminha apenas o cookie `token`, valida `Origin` nas mutações e responde `private, no-store`, preservando status.
- Login transfere o cookie emitido pelo backend para o domínio do Next como `HttpOnly`; o navegador nunca recebe o valor em JavaScript. `SameSite=Lax`, `Path=/` e `Secure` em produção.
- Perfil é carregado no navegador via `/api/users/me` e service correspondente; exibe loading, erro, estado sem sessão e dados. `401` limpa a identidade; `403` preserva a sessão e informa falta de permissão.
- No projeto atual, a justificativa concreta de `app/api` é a ponte de autenticação por cookie HttpOnly nas chamadas do navegador. Leituras executadas no servidor Next podem chamar o backend diretamente. Quando esse caso surgir, reutilizar o tratamento HTTP comum com destino explícito; não criar um segundo service por domínio antecipadamente.
- Esta fase não mantém um cliente/service de autenticação SSR. Se uma tela futura demonstrar necessidade de SSR autenticado, ela poderá ler `cookies()` no Next e encaminhar explicitamente o cookie, com leitura isolada por requisição e sem cache compartilhado.
- Em desenvolvimento, Next (`localhost:3000`) chama a API (`localhost:8000`) somente pelo BFF. Em produção, `BACKEND_API_URL` é configuração server-only do runtime Next; hostname e conectividade reais do backend ainda precisam ser confirmados antes do aceite da 2.2.

Revisão baseada no frontend em `nextjs-frontend`, nos controllers e DTOs de `nodejs-backend/src`, no registro de rotas de `server.ts` e nos exemplos de `nodejs-backend/api.http`. Esta etapa documenta decisões; não migra telas.

## Arquitetura inicial (histórico; não seguir nos próximos handoffs)

As recomendações e tabelas desta seção registram o levantamento original, não a decisão vigente. Em particular, suas sugestões de SSR autenticado para perfil, carrinho e outras telas não foram implementadas nem são requisito da 2.2. Para a 2.2, vale a revisão no início deste arquivo; nas etapas futuras, escolher server/client por necessidade concreta de cada tela.

```text
Server Component ──> service server ──> API
                                  cookie encaminhado explicitamente
Client Component ──> hook de interação ──> service browser ──> BFF same-origin ──> API
```

- `lib/api/client.ts`: base URL, serialização JSON, `credentials`, cabeçalhos, leitura segura de `204`, parsing de `{ error }` e `{ message }`, e `ApiError(status, message, body)`. Não lança erro baseado apenas em `response.ok` sem preservar o status.
- `lib/api/server.ts` e `lib/api/browser.ts`: implementações distintas. A versão server usa `cookies()` e encaminha `Cookie: token=...` explicitamente; a versão browser chama rotas BFF da mesma origem e usa `credentials: "same-origin"`.
- `services/{auth,catalog,cart,checkout,orders,payments,refunds,deliveries,reviews,inventory,dashboard}.ts`: funções por operação, com inputs e DTOs da API. Services não mantêm estado React e podem ser chamados diretamente por Server Components para leituras.
- `hooks/`: apenas para interação/estado de Client Components — loading, erro, mutação, invalidação/atualização local. Não criar hooks que só repassem uma Promise sem estado ou necessidade de interação.
- `types/api/`: contratos wire em JSON (datas ISO como `string`) e filtros. `types/view/` fica reservado a modelos de apresentação que realmente difiram do wire DTO. Nunca importar tipos Prisma no frontend.

### Contexto da proposta original: cookies, SSR e erros

O backend emite `token` HttpOnly no `Set-Cookie`; o body do login contém apenas uma mensagem. `/users/me` consulta a identidade e role atuais. Não ler JWT do body, não usar `localStorage` para token e não codificar IDs de perfil como identidade.

No desenvolvimento, frontend e API usam `localhost` em portas diferentes; cookies não são isolados por porta e as chamadas browser precisam de `credentials: "include"` se forem diretas à API. Em produção, o CORS já menciona `https://v-market-one.vercel.app`, mas o cookie não define `Domain`; um cookie host-only recebido da API não é enviado na requisição SSR para outro host. `credentials: "include"` no `fetch` server-side também não copia o cookie da requisição de entrada.

**Decisão recomendada:** adotar BFF/Route Handlers Next em same-origin nos dois ambientes. Login/logout passam pelo BFF, que encaminha a operação à API e repassa `Set-Cookie` ao host do frontend com `HttpOnly`, `Secure` em produção, `SameSite` coerente e `Path=/`. O BFF encaminha o cookie ao backend nas demais operações. Server Components podem chamar os services server diretamente, obtendo `cookies()` e montando o header `Cookie` explicitamente. Se preferirmos cookie compartilhado em vez de BFF, só é viável após confirmar que os domínios compartilham o mesmo domínio registrável e definir `Domain` no backend.

Tratamento: `401` limpa a sessão visual e direciona para login; `403` mantém a sessão e mostra falta de permissão; `404` apresenta recurso indisponível; `409` mostra conflito recuperável (estoque, duplicidade, estado/idempotência) preservando formulário; `400` associa validação aos campos; `5xx`/rede mostra erro geral. `204` retorna `undefined` sem tentar `response.json()`. O cliente aceita tanto `{ error }` como `{ message }`, pois os controllers ainda não padronizam um único envelope.

## Chamadas e telas

| Domínio / chamadas reais | Leitura inicial | Interação | Tela e fase |
|---|---|---|---|
| Catálogo: `GET /products`, `/search`, `/category/:category`, `/seller/:sellerId`, `/:productIds` | Server Component para busca/listagem/detalhe derivadas de `searchParams`; requests já paginados | Filtros alteram URL e disparam nova renderização; add-to-cart e estado de modal são client | `/products`, `productsPageClient`, `productOverview`, cards e busca — **editar, 2.3**. `/store/[storeId]/products` — **editar, 2.3** |
| Reviews: `GET /products/:id/reviews`, `/sellers/:id/reviews`, `/reviews/:id` | Server para reputação e primeira página pública | Client para página seguinte, criação e PATCH do autor | Detalhe/listagem de produto e loja — **editar, 2.6**. `/reviews` central — **criar só se necessário, 2.6** |
| Identidade: login/logout/register, `GET /users/me`, `GET/POST/PUT /customers`, `GET/POST/PUT /sellers` | `/users/me` no server em layouts/páginas protegidas depois do BFF | Login, registro, logout, edição e atualização visual ficam client; após login/logout atualizar sessão e navegar/refresh | Context, header, formulários, profile — **editar, 2.2** |
| Endereços: `/customers/addresses` CRUD e `/default` | Server ao abrir perfil/checkout protegido | Criar/editar/default/desativar no client; refrescar lista/default | Checkout/perfil — **editar, 2.4** |
| Carrinho: `GET /cart` | Server na entrada da página autenticada; não usar `localStorage` como verdade do carrinho autenticado | Add, quantidade, remover e limpar em client; estado otimista só reconciliado com resposta | `/cart` — **editar, 2.4**. Migração/merge de carrinho anônimo não tem endpoint v2: decidir separadamente; não simular merge no checkout |
| Checkout: `POST /checkout` com `addressId`, `Idempotency-Key` | — | Client no submit. Gerar chave por tentativa lógica e reutilizar a mesma chave em retry; criar novo key apenas para nova tentativa | `/cart/checkout` e resumo — **editar, 2.5** |
| Orders/SellerOrders: `GET /orders`, `/:orderId`, `/seller-orders`, `/:id`; `PATCH /seller-orders/:id/status` | Server para histórico/detalhe autenticado, filtrado e paginado pelo backend | Filtros client somente se refletidos na URL/service; transição SellerOrder em client | `/orders`, `/orders/[orderId]/tracking` — **editar, 2.5**. Gestão do seller — **criar seção, 2.6** |
| Payments: `GET /orders/:id/payment-attempts`, `/payment-attempts/:id`; POST tentativa | Server para estado inicial do pedido | POST envia somente `{ method }`; atualizar estado a partir da resposta | `/cart/payment`, `/cart/payment/success`, confirmação — **editar, 2.6** |
| Refunds: GET por attempt e `/refunds/:id`; POST por attempt | Server para histórico/detalhe | Solicitação explícita em client | `/refunds` — **criar funcionalidade, 2.6**; depende de attempt `CAPTURED` |
| Deliveries: por SellerOrder, delivery e history | Server para tracking inicial | Seller atualiza tracking/status em client | Tracking customer — **editar, 2.5/2.6**; gestão seller — **criar seção, 2.6** |
| Inventory: GET produto/movements | Server na entrada da seção seller | Restock/adjustment em client | Gestão de inventário não tem página completa — **criar, 2.3** |
| Dashboard: `/dashboard/seller/*` | Server para snapshot inicial protegido | Filtros de período podem atualizar URL (preferível) ou buscar via client | `components/dashboard.tsx`, `/store/[storeId]` — **editar, 2.6** |
| Clientes do seller / wishlist | Não há endpoint v2 para clientes do seller nem contrato de wishlist | Não inventar chamada nem persistência | `/store/[storeId]/customers` — avaliar remoção/placeholder, sem tela de clientes até haver endpoint; `/wishlist` **fora do escopo** |

### Preferência server/client por tela

Leituras públicas com URL reproduzível (catálogo e reviews públicas) são boas para Server Components e navegação indexável. Carrinho e perfil começam como leituras server para evitar tela vazia/fetch em cascata, mas controles seguem client. Checkout, mutations, login, tracking editável e filtros efêmeros pertencem ao client. As telas atuais dependem de `localStorage` para carrinho anônimo e resumo/endereço (`order-summary`, `delivery-address`); esse estado só existe no navegador e não pode ser lido durante SSR. O novo fluxo usa API como fonte do carrinho/endereços e mantém em client apenas seleção temporária até o POST de checkout.

### Mapa por rota existente ou proposta

| Tela | Chamadas principais | Renderização e interação | Ação / fase |
|---|---|---|---|
| `/` | catálogo/search | Server para dados por URL; busca com navegação por URL, UI client | Editar, 2.3 |
| `/products` | `GET /products`, search/category/IDs, reviews públicas | Server para primeira página; filtros URL; add cart client | Editar, 2.3 |
| `/store/[storeId]` | seller profile, dashboard | Server protegido após BFF; filtros interativos por URL | Editar, 2.6 |
| `/store/[storeId]/products` e `/products/new` | seller profile, products CRUD, inventory | Server para catálogo; formulários e mutations client | Editar, 2.3 |
| `/store/[storeId]/customers` | não há endpoint v2 correspondente | Sem leitura a implementar até decisão de produto/novo contrato | Avaliar; não inventar endpoint |
| `/cart` | `GET /cart`, item mutations | Server para carrinho autenticado; quantidade/remoção client | Editar, 2.4 |
| `/cart/checkout` | addresses, `POST /checkout` | Server para endereços; seleção e envio client | Editar, 2.4–2.5 |
| `/cart/order-summary` | cart/address atual | Server para estado persistido; remover resumo autoritativo do localStorage | Editar, 2.4 |
| `/cart/payment` | criar/listar PaymentAttempt | Client inicia cobrança explicitamente; service atualiza tela | Editar, 2.6 |
| `/cart/payment/success` e `/cart/order-confirmation` | GET Order e payment attempts | Server lê pedido real por ID; nenhuma criação/limpeza lateral | Editar, 2.6 |
| `/orders` e `/orders/[orderId]/tracking` | Orders, SellerOrders e Delivery/history | Server para leitura protegida; filtros URL e tracking conforme role | Editar, 2.5–2.6 |
| `/profile` | `/users/me`, `/customers`, `/sellers`, addresses | Server para inicial; formulários e update client | Editar, 2.2 e 2.4 |
| Login/register, header, contexto/modal | login/logout/register, `/users/me`, profiles | Client para ações e sessão visual; BFF faz ponte de cookie | Editar, 2.2 |
| `/refunds` | Refund collection/detail/create | Server para histórico; solicitação client | Construir, 2.6 |
| `/reviews` | reviews por alvo | Não precisa ser central se telas de produto/loja já cobrem o uso | Só construir se necessário, 2.6 |
| Inventário e SellerOrders/Deliveries do seller | inventory, SellerOrders, Delivery | Server nas listas; mutations client | Criar seção/páginas, 2.3 e 2.6 |
| `/wishlist` | sem API v2 | localStorage atual não representa wishlist persistida | Fora desta migração |

## Contratos v1 → v2

Os tipos atuais em `nextjs-frontend/types` são modelos legados e misturam apresentação com contrato: `Product.price/stock/seller`, `CartItem.userdId`, `Address.id:number/zipcode/district`, `Order.totalPrice/orderItems/unitPrice`, `Delivery.orderId`, `Seller.rating`, `User.password` e roles minúsculas. Substituição recomendada:

| Tipo wire frontend | DTO backend atual | Ajuste necessário |
|---|---|---|
| `Product` | `ProductReadDto` e `ProductCollectionDto` | `priceInCents`, `currency`, `inventory.availableQuantity`, `isAvailable`, `sellerId`, `sellerName`; remover `price`, `stock` e `seller.storeName`. Coleções são `{ data, pagination }`; busca/categoria/seller/estoque e contagem devem ser filtrados antes da paginação no backend. |
| `Cart` / `CartItem` | `CartDto` / `CartItemDto` | `totalInCents`, `lineTotalInCents`, `hasSufficientStock`, `isAvailable`; disponibilidade é informativa. Remover `userdId` e produto aninhado legado. |
| `Address` | `CustomerAddressDto` | ID string; `postalCode`, `neighborhood`, `state`, `countryCode`, `recipientName` etc.; `isDefault`. Perfil Customer contém apenas telefone, não endereço textual. |
| `Order` / `SellerOrder` / `OrderItem` | `OrderDetailDto`, `SellerOrderDetailDto`, snapshots | status enums schema v2, `totalInCents`, `unitPriceInCents`, `lineTotalInCents`, `sellerOrders[]`, `items[]`, `address` snapshot e históricos. Eliminar `totalPrice`, `unitPrice`, `orderItems` planos e status PAID/REFUNDED herdados. |
| Checkout | `CheckoutDto` | resposta persistida contém `sellerOrders[].items[].reservation` (nullable); orderId vem da resposta, não de criação na tela de sucesso. |
| Payment | `PaymentAttemptDto/CollectionDto` | cobrança integral em `amountInCents`, `currency`, provider/status/timestamps; criação `{ method }`. Sem parcelamento como múltiplas tentativas. |
| Refund | `RefundDto/CollectionDto` | `paymentAttemptId`, `amountInCents`, `currency`, status e timestamps; valores em centavos e estados `REQUESTED/PROCESSING/COMPLETED/DECLINED/FAILED`. |
| Delivery | `DeliveryDto` / history | vincula `sellerOrderId`, nunca `orderId`; campos de tracking, status e timestamps. |
| Review | `ReviewDto/CollectionDto` | alvo product ou seller, `rating/comment`, reputação e paginação; o DTO público não inclui dados privados do autor. |
| Dashboard | DTOs `SellerDashboard*` | receita bruta em centavos, SellerOrders, períodos, categorias, top products por snapshot, novos customers e reviews diretas ao seller. Refunds não são descontados. |
| User/profile | `UserDto`, `AuthenticatedUserDto`, Customer/Seller profile DTOs | roles `ADMIN | SELLER | CUSTOMER`; resposta User não tem senha. Separar User, CustomerProfile e Seller. Datas de todos os DTOs com `Date` interno tornam-se strings ISO no JSON. |

Formatar moeda somente na UI (centavos / 100 no formatador). Manter API DTO distinto de view model; view model pode preparar label/preço formatado, sem substituir nem adulterar o valor wire.

Até OpenAPI (Fase 3), manter os tipos API explícitos no frontend por domínio, com links/comentários ao controller e DTO fonte do backend. Validar requests/response com exemplos de `api.http` e uma tabela de rotas; evitar compartilhar tipos Prisma via pacote. Na fase 3, gerar tipos de OpenAPI e comparar snapshots de contrato.

## Incompatibilidades que afetam implementação

1. `/cart/payment/success` ainda cria Order, Delivery e limpa carrinho via endpoints v1; deve passar a exibir o ID de checkout existente e consultar Order. Criar Delivery não é efeito de pagamento.
2. `/orders` consulta `/orders/customer/:customerId` e filtra uma lista em memória; v2 é `GET /orders` com ownership pelo cookie, paginação/status/datas no backend.
3. Login atual do frontend parece tratar sessão via requests diretas; o BFF deve repassar `Set-Cookie` sem expor o valor ao JavaScript. Registro deve criar perfil após registro/login, sem `ADMIN` público.
4. Seller dashboard chama rotas `/dashboard/sellers/.../:sellerId` antigas e soma múltiplas projeções client-side; v2 é `/dashboard/seller/*` e deriva seller do usuário autenticado.
5. Várias páginas usam `/cart-items`, `/delivery/order/:orderId`, `/orders` POST e campos de payload v1; rotas equivalentes não existem na API atual.
6. CustomerAddress e `CustomerProfile.address` foram confundidos no frontend; v2 usa recurso estruturado de endereços.
7. Sellers não têm tela completa de inventory, SellerOrders/delivery; criar essas seções antes de ligar navegação do header. `/store/[storeId]/customers` não tem endpoint correspondente.
8. O dashboard não oferece receita líquida ou atribuição de refunds ao seller. Wishlist não tem contrato. Ambos permanecem fora da migração v2 atual.

## Primeira fatia recomendada da Fase 2 — decisão revisada

**2.2 — sessão e perfil mínimo**: caminho principal navegador → hook opcional → service de domínio → `lib/http.ts` → Route Handler `/api` → backend. Usar um único cliente HTTP do navegador, services `auth`, `user`, `customer`, `seller`, BFF com destinos fixos e perfil consultado no browser. Não manter client/service de autenticação SSR nesta fase. Critérios: login usa cookie HttpOnly sem expor JWT; registro cria perfil v2; refresh recarrega `/users/me` e perfil; logout limpa o cookie; header reflete a sessão; acesso direto a `/profile` não autenticado leva ao login; 401 limpa a sessão visual; 403 preserva sessão e exibe permissão negada; mutações BFF validam origem e não são cacheadas. SSR autenticado só entra quando uma tela justificar, encaminhando o cookie explicitamente e isolando cache por usuário.

Depois, usar `/products` como primeira fatia visual 2.3: leitura server paginada via URL, filtros aplicados no backend e card que consome o DTO v2; manter add-to-cart como interação client via service/hook. Critérios: preço/estoque v1 não existem nos tipos consumidos; troca de página/filtro preserva URL e metadados; disponibilidade mostra `isAvailable`; adicionar ao carrinho atualiza UI pela resposta do backend e não pelo catálogo filtrado localmente.

## Rotas e cobertura

Os grupos registrados em `server.ts` e detalhados nos controllers são: `/`, `/users/*`, `/customers/*`, `/customers/addresses/*`, `/sellers/*`, `/products/*`, `/inventory/products/*`, `/cart/*`, `/checkout`, `/orders/*`, `/seller-orders/*`, `/payment-attempts/*`, `/refunds/*`, `/deliveries/*`, `/products/:id/reviews`, `/sellers/:id/reviews`, `/reviews/:id` e `/dashboard/seller/*`. O `api.http` cobre esses grupos, mas é uma coleção manual de requests e não uma especificação tipada: antes da fase 3, conferir exemplos contra os DTOs e validar que a variável de `Set-Cookie` é enviada como um header Cookie contendo o par `token=...`, sem depender do cookie jar. Neste levantamento, root e logins seed responderam 200 com `Set-Cookie`; a verificação automatizada local de `/users/me` por Cookie não foi conclusiva, então a sessão browser/BFF permanece critério de prova da fatia 2.2. O código do middleware aceita tanto Bearer quanto `req.cookies.token`. Nenhum fluxo mutável foi executado.

## Referência do Next.js

No Next.js 15.3 instalado, `cookies()` é assíncrono e lê os cookies da requisição de entrada em Server Components; gravar/apagar cookie exige Server Action ou Route Handler. A chamada server-side precisa incluir explicitamente o cookie ao fazer fetch para outra API. [Documentação de `cookies()`](https://nextjs.org/docs/app/api-reference/functions/cookies) · [Documentação de `fetch`](https://nextjs.org/docs/app/api-reference/functions/fetch).

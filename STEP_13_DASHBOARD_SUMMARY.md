# Etapa 13 — Dashboards e relatórios

## Objetivo

Atualizar o dashboard do seller para o schema-v2, utilizando `SellerOrder` como unidade comercial, valores monetários em centavos, ownership pelo usuário autenticado e agregações executadas no PostgreSQL.

## Ownership

O seller deixou de ser recebido pela URL ou pelo body.

```text
req.user.id → Seller.userId → Seller.id
```

Somente usuários com role `SELLER` e perfil correspondente acessam o dashboard. Customers recebem `403`, e as rotas legadas que aceitavam `sellerId` foram removidas.

## Unidade comercial

As métricas do seller utilizam `SellerOrder`, e não a `Order` completa do marketplace.

Receita bruta reconhecida:

```text
SellerOrder.status = DELIVERED
SellerOrder.totalInCents
SellerOrder.completedAt dentro do período
```

SellerOrders em `RETURNED`, `CANCELLED` ou estados operacionais não compõem essa receita.

Refunds não são descontados porque o schema atual não os relaciona diretamente a um seller ou `SellerOrder`. Portanto, o dashboard apresenta receita bruta, não receita líquida.

## Rotas

```text
GET /dashboard/seller/summary
GET /dashboard/seller/orders
GET /dashboard/seller/orders/by-status
GET /dashboard/seller/sales/timeseries
GET /dashboard/seller/sales/by-category
GET /dashboard/seller/products/top
GET /dashboard/seller/customers/new
GET /dashboard/seller/ratings
```

Todas as rotas exigem autenticação.

## Filtros e paginação

Os relatórios aceitam intervalos `from` e `to` no formato `YYYY-MM-DD`.

- `from` é inclusivo;
- o dia informado em `to` é inclusivo e convertido para o início exclusivo do dia seguinte;
- intervalos invertidos, datas inexistentes e intervalos excessivos são rejeitados;
- a listagem de SellerOrders usa `createdAt`;
- as métricas de receita usam `completedAt`.

A listagem aplica filtros antes da paginação e ordena por:

```text
createdAt DESC, id DESC
```

## Métricas

O resumo apresenta:

- moeda;
- receita bruta em centavos;
- SellerOrders entregues;
- unidades vendidas;
- ticket médio em centavos.

A distribuição por status inclui todos os valores de `SellerOrderStatus`, mesmo quando a contagem é zero.

As séries temporais suportam intervalos diários e mensais, em ordem crescente, preenchendo períodos sem vendas com zero.

Os buckets temporais são intersectados com o intervalo global solicitado. Assim, uma consulta parcial dentro de um mês não inclui vendas externas ao período.

## Categorias e produtos

As vendas por categoria agregam:

```text
OrderItem.lineTotalInCents
OrderItem.quantity
```

A categoria utiliza o produto atual, pois `OrderItem` não possui snapshot de categoria.

Os produtos mais vendidos retornam:

- `productId`;
- nome histórico;
- unidades vendidas;
- receita bruta em centavos.

O nome é obtido do `productNameSnapshot` elegível mais recente, ordenado por `OrderItem.createdAt DESC, id DESC`. Ele não depende do nome atual do produto nem de ordenação lexical com `MAX`.

## Novos customers e ratings

Um customer é considerado novo para o seller na primeira `SellerOrder` existente entre ambos. Compras anteriores fora do período impedem que ele seja contado novamente.

Ratings reutilizam a reputação da Etapa 12 e consideram somente reviews direcionadas diretamente ao seller.

## Arquitetura e consultas

Foi criado `DashboardRepository` como read model analítico composto.

```text
controller  → HTTP, autenticação e parsing
service     → ownership, períodos e composição dos DTOs
repository  → agregações Prisma e SQL parametrizado
types       → filtros e DTOs explícitos
```

Os métodos de dashboard foram removidos do `OrderRepository`.

As agregações ocorrem no banco, sem carregar todas as vendas no service e sem executar consultas individuais por pedido, categoria ou produto.

## Validação final

- TypeScript aprovado.
- Dashboard: 7 testes aprovados.
- Reviews: 10 testes aprovados.
- Orders: 14 testes aprovados.
- Catálogo: 23 testes aprovados.
- Banco/schema: 12 testes aprovados.
- Total executado: **66 testes aprovados**.

## Limites de escopo

Não foram implementados:

- receita líquida por seller;
- alocação de refunds por seller ou produto;
- comissões, taxas ou impostos da plataforma;
- dashboard administrativo ou de customer;
- cache ou materialized views;
- exportação de relatórios;
- frontend.

A categoria representa o cadastro atual do produto, porque ainda não existe snapshot histórico de categoria no `OrderItem`.

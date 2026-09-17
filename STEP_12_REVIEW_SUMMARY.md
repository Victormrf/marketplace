# Etapa 12 — Reviews e reputação

## Objetivo

Implementar reviews de produtos e sellers compatíveis com o schema-v2, com autorização baseada em compra entregue, ownership, unicidade e cálculo eficiente de reputação.

## Tipos de review

Cada review possui exatamente um alvo:

```text
Review de produto: productId preenchido e sellerId nulo
Review de seller:  sellerId preenchido e productId nulo
```

O alvo é obtido pela rota. `userId`, `productId` e `sellerId` não podem ser definidos pelo body.

## Autorização por compra

Somente um usuário autenticado com role `CUSTOMER` pode criar reviews.

Para avaliar um produto, o customer precisa possuir um `OrderItem` daquele produto dentro de um `SellerOrder` com status `DELIVERED`.

Para avaliar um seller, o customer precisa possuir um `SellerOrder` daquele seller com status `DELIVERED`.

O uso de `SellerOrder.DELIVERED` permite tratar separadamente as entregas dos diferentes sellers de uma mesma `Order`.

## Unicidade e concorrência

O banco garante:

```text
uma review por usuário e produto
uma review por usuário e seller
```

Em criações concorrentes, a constraint única do PostgreSQL permite somente uma inserção. A violação `P2002` do Prisma é convertida em `409 Conflict`.

Não foi necessário utilizar lock pessimista para essa regra.

## Atualização e ownership

Somente o autor pode atualizar a review.

O `PATCH` aceita apenas:

- `rating`;
- `comment`.

Campos omitidos são preservados. O tratamento do comentário diferencia:

- propriedade ausente: não altera o comentário;
- `null`: remove explicitamente o comentário;
- texto vazio ou somente espaços: normaliza para `null`;
- texto preenchido: aplica `trim` e persiste;
- mais de 2000 caracteres: rejeita a entrada.

O rating deve ser um inteiro entre 1 e 5.

A exclusão física não foi exposta, pois o schema atual não possui mecanismo de exclusão lógica e a remoção apagaria o histórico.

## Rotas

```text
POST  /products/:productId/reviews
GET   /products/:productId/reviews

POST  /sellers/:sellerId/reviews
GET   /sellers/:sellerId/reviews

GET   /reviews/:reviewId
PATCH /reviews/:reviewId
```

As rotas legadas de review e exclusão foram removidas.

## Consultas e reputação

As coleções possuem:

- paginação;
- filtro opcional por rating;
- ordenação por `createdAt DESC, id DESC`;
- DTOs explícitos;
- retorno `200` com array vazio quando não existem reviews.

A reputação retorna:

```text
averageRating
totalReviews
distribution de 1 a 5 estrelas
```

As contagens são agrupadas no banco, sem carregar todas as reviews em memória e sem executar uma consulta por item.

As reputações permanecem separadas:

- rating de produto considera somente reviews daquele produto;
- rating de seller considera somente reviews direcionadas ao seller;
- reviews de produtos não alteram implicitamente a reputação do seller.

## Arquitetura

O `ReviewModel` legado foi substituído por `ReviewRepository`.

As responsabilidades ficaram distribuídas entre:

```text
controller  → protocolo HTTP e parsing
service     → autorização e regras de negócio
repository  → consultas e persistência Prisma
types       → inputs, filtros e DTOs
```

## Validação final

- TypeScript aprovado.
- Reviews: 10 testes aprovados.
- Catálogo: 23 testes aprovados.
- Orders: 14 testes aprovados.
- Total executado nesta validação: **47 testes aprovados**.

## Limites de escopo

Não foram implementados:

- moderação de conteúdo;
- exclusão lógica de reviews;
- respostas do seller;
- cache de reputação;
- filas ou processamento assíncrono;
- alterações no frontend;
- dashboards e relatórios consolidados.

# Etapa 14 — Limpeza e fechamento

## Objetivo

Encerrar a baseline funcional do backend schema-v2, removendo contratos legados, corrigindo scripts de desenvolvimento, eliminando artefatos compilados obsoletos e validando o sistema completo a partir de uma build limpa.

## Código legado removido

Foram removidos do `dist` artefatos sem correspondência no `src`, incluindo:

- Models antigos;
- controllers antigos de `CartItem` e `OrderItem`;
- services antigos de `CartItem` e `OrderItem`;
- `productReadRepository` substituído;
- outros arquivos compilados que o TypeScript não removia automaticamente.

Nenhum Model legado permanecia no código-fonte.

A rota legada de exclusão física de `CustomerProfile` e seu método sem implementação real foram removidos.

## Build limpa

Foi criado:

```text
scripts/clean-dist.js
```

O script resolve e valida o caminho fixo de `nodejs-backend/dist` antes de removê-lo.

A build passou a executar:

```text
clean:dist → tsc
```

Assim, arquivos JavaScript antigos não sobrevivem entre compilações.

## Seed cleaner

O `prisma/seedCleaner.js` foi atualizado para os nomes atuais do Prisma Client e para a ordem correta das dependências.

O trecho financeiro respeita:

```text
Refund → PaymentAttempt → Order
```

Isso evita violações de foreign key com `onDelete: Restrict`.

O cleaner recusa execução fora de:

```text
localhost ou 127.0.0.1
porta 5433
banco marketplace_dev
```

A validação acontece antes da criação do Prisma Client e de qualquer escrita.

## Validação do ciclo local

O ciclo completo foi executado:

```text
clean-seed
→ confirma PaymentAttempt = 0 e Order = 0
→ seed determinístico
→ build
→ typecheck
→ test:all
```

O cleaner terminou sem erro de foreign key e o seed reconstruiu o banco local corretamente.

Uma URL remota fictícia foi rejeitada antes de qualquer conexão ou escrita.

## Scripts e dependências

Foram adicionados:

```text
npm run clean:dist
npm run test:all
```

O `test:all` executa as suítes sequencialmente e encerra diante da primeira falha.

A dependência `date-fns`, que não possuía mais consumidores, foi removida.

O cron de delivery não permanece como dependência ou responsabilidade do servidor HTTP.

## Artefatos preservados

Foram preservados sem alteração:

```text
prisma/schema.prisma
prisma/migrations/20260910120000_schema_v2_baseline
prisma/migrations/migration_lock.toml
prisma/migrations_legacy_v1
```

As migrations v1 continuam arquivadas somente como histórico.

## Validação final

- Build limpa: aprovada.
- TypeScript: aprovado.
- Banco/schema: 12 testes.
- Catálogo de leitura: 23 testes.
- Catálogo de escrita: 19 testes.
- Inventário: 14 testes.
- Autenticação e perfis: 18 testes.
- Endereços: 12 testes.
- Carrinho: 5 testes.
- Checkout: 15 testes.
- Orders: 14 testes.
- Pagamentos: 14 testes.
- Refunds: 8 testes.
- Deliveries: 13 testes.
- Reviews: 10 testes.
- Dashboard: 7 testes.
- Total: **184 testes aprovados**.

## Resultado

O backend está alinhado ao schema-v2 e possui uma baseline funcional para as próximas fases de aprendizado de system design.

Os próximos recursos, como dados sintéticos em escala, cache, filas, workers, observabilidade e resiliência, permanecem fora desta baseline e devem ser introduzidos gradualmente.

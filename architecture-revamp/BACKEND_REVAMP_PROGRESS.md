# Backend Revamp — Controle de Progresso

Última atualização: 18/09/2026 — Baseline funcional do backend concluída

## Objetivo

Alinhar gradualmente o backend ao schema-v2 antes de introduzir carga sintética e mecanismos de system design como cache, filas, workers, observabilidade e resiliência.

## Legenda

- `[x]` Concluída e validada
- `[~]` Etapa atual
- `[ ]` Pendente
- `[!]` Correção necessária antes de avançar

## Fundação do schema

- [x] Schema-v2 normalizado e migration baseline
- [x] PostgreSQL local via Docker para desenvolvimento
- [x] Baseline aplicada no banco local
- [x] Seed determinístico mínimo
- [x] Testes das invariantes prioritárias do banco
- [x] Relatório final de compatibilidade

## Application-wide base revamp

### Etapa 1 — Catálogo e inventário de leitura

- [x] DTO explícito de produto
- [x] `priceInCents` e `currency`
- [x] leitura de `Inventory`
- [x] cálculo de `availableQuantity`
- [x] paginação e ordenação determinística
- [x] filtro fixo de produtos e sellers ativos
- [x] ratings sem N+1

### Etapa 2 — Escrita de catálogo e consolidação do repository

- [x] `ProductModel` substituído por `ProductRepository`
- [x] criação transacional de Product + Inventory zerado
- [x] atualização por whitelist
- [x] ownership pelo seller autenticado
- [x] desativação lógica
- [x] autorização antes da idempotência de desativação
- [x] consulta duplicada de autorização removida

### Etapa 2.1 — Filtros composáveis do catálogo

- [x] parsing de `search`, `category`, `sellerId` e `inStock`
- [x] `isAvailable` no DTO
- [x] filtros aplicados antes da paginação
- [x] comparação de disponibilidade executada no PostgreSQL via Prisma FieldReference
- [x] busca global de IDs e `WHERE id IN (...)` removidos
- [x] `count()` e `findMany()` usam o mesmo filtro sem materialização em memória
- [x] build, testes e paginação validados após a correção

### Etapa 3 — Operações de inventário

- [x] entrada de estoque
- [x] retirada e ajuste manual
- [x] atualização atômica e transacional
- [x] `InventoryMovement` obrigatório
- [x] consulta paginada do histórico
- [x] ownership e autorização
- [x] alteração de estoque isolada dos endpoints de produto
- [x] rollback e concorrência entre retiradas validados

Observação futura: se desativação de produto/seller e movimentação de estoque puderem ocorrer concorrentemente em produção, ambas deverão compartilhar um lock ou isolamento transacional sobre o recurso de catálogo. Isso não bloqueia o escopo atual.

### Etapa 4 — Autenticação e perfis

- [x] `normalizedEmail`
- [x] separação entre User, CustomerProfile e Seller
- [x] contas ativas
- [x] ownership sem confiar em IDs enviados pelo cliente
- [x] repositories substituíram Models legados
- [x] JWT com identidade mínima e role atual carregada do banco
- [x] DTOs seguros sem senha ou `normalizedEmail`
- [x] desativação lógica e idempotente

### Etapa 5 — Endereços do cliente

- [x] CRUD de `CustomerAddress`
- [x] endereço default único
- [x] desativação lógica
- [x] ownership
- [x] atualização condicionada atomicamente a endereço ativo

### Etapa 6 — Carrinho

- [x] um Cart ACTIVE por customer
- [x] `CartItem.cartId`
- [x] merge de itens repetidos
- [x] validação informativa de disponibilidade
- [x] ownership

### Etapa 7 — Checkout transacional e reservas

- [x] Order e SellerOrders
- [x] OrderItems e snapshots
- [x] OrderAddress
- [x] reserva atômica de inventário
- [x] InventoryReservation e InventoryMovement
- [x] tratamento de concorrência
- [x] rollback completo
- [x] locks compartilhados para snapshots comerciais consistentes
- [x] DTO explícito de checkout

### Etapa 8 — Idempotência do checkout

- [x] persistência da chave
- [x] fingerprint determinístico da requisição
- [x] replay seguro do resultado persistido
- [x] concorrência com uma única execução efetiva
- [x] rejeição de chave reutilizada com payload diferente
- [x] rollback conjunto da chave e do checkout

### Etapa 9 — Consultas e estados de pedidos

- [x] visão consolidada do customer
- [x] visão do SellerOrder
- [x] históricos
- [x] máquinas de estado
- [x] ownership

### Etapa 10 — Pagamentos e reembolsos

- [x] múltiplos PaymentAttempts com somente um ativo ou capturado por Order
- [x] valores em centavos
- [x] cobrança e captura integral da Order
- [x] provider simulado, idempotência e reconciliação
- [x] múltiplos refunds financeiros parciais
- [x] limites acumulados e concorrência de refunds
- [x] máquinas de estado de PaymentAttempt e Refund

Observação de escopo: refunds permanecem relacionados ao `PaymentAttempt`, sem vínculo estruturado por produto, `OrderItem`, `SellerOrder` ou seller.

### Etapa 11 — Entregas

- [x] Delivery por SellerOrder
- [x] ownership separado para leitura e escrita
- [x] histórico e máquina de estados
- [x] tracking com whitelist
- [x] concorrência e rollback transacional
- [x] cron removido do servidor HTTP
- [x] job independente e paginado
- [x] progressão temporal baseada em `DeliveryStatusHistory.changedAt`

### Etapa 12 — Reviews e reputação

- [x] alvo exclusivo produto ou seller
- [x] unicidade e ownership
- [x] autorização por compra entregue
- [x] rating calculado

### Etapa 13 — Dashboards e relatórios

- [x] agregações por SellerOrder
- [x] valores e status do schema-v2
- [x] paginação e filtros temporais
- [x] eliminar N+1

### Etapa 14 — Limpeza e fechamento

- [x] remover contratos e campos legados
- [x] remover scripts incompatíveis
- [x] revisar artefatos `dist/`
- [x] executar suíte completa e smoke tests

## Próxima ação

A baseline funcional do backend schema-v2 está concluída. A próxima fase deve ser definida separadamente antes da introdução gradual de dados sintéticos e mecanismos de system design.

## Protocolo de atualização

Ao concluir uma etapa:

1. executar os testes e smoke tests definidos no handoff;
2. registrar eventuais lacunas;
3. trocar sua marcação para `[x]`;
4. mover `[~]` para a próxima etapa;
5. atualizar a data no topo deste arquivo.
6. criar um arquivo `STEP_<N>_<DOMINIO>_SUMMARY.md` na raiz, seguindo o padrão dos resumos anteriores e registrando objetivo, fluxo, regras, validação e limites de escopo.

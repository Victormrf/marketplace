# Backend Revamp — Controle de Progresso

Última atualização: 12/09/2026

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
- [!] Substituir a busca global de IDs + `WHERE id IN (...)` por uma consulta paginada no banco
- [!] Evitar repetir a consulta de disponibilidade em `count()` e `findMany()` de forma não escalável
- [~] Validar novamente build, testes e paginação após a correção

### Etapa 3 — Operações de inventário

- [ ] entrada de estoque
- [ ] retirada e ajuste manual
- [ ] atualização transacional
- [ ] `InventoryMovement` obrigatório
- [ ] consulta do histórico
- [ ] ownership e autorização
- [ ] impedir alteração de estoque pelo endpoint de produto

### Etapa 4 — Autenticação e perfis

- [ ] `normalizedEmail`
- [ ] separação entre User, CustomerProfile e Seller
- [ ] contas ativas
- [ ] ownership sem confiar em IDs enviados pelo cliente

### Etapa 5 — Endereços do cliente

- [ ] CRUD de `CustomerAddress`
- [ ] endereço default único
- [ ] desativação lógica
- [ ] ownership

### Etapa 6 — Carrinho

- [ ] um Cart ACTIVE por customer
- [ ] `CartItem.cartId`
- [ ] merge de itens repetidos
- [ ] validação informativa de disponibilidade
- [ ] ownership

### Etapa 7 — Checkout transacional e reservas

- [ ] Order e SellerOrders
- [ ] OrderItems e snapshots
- [ ] OrderAddress
- [ ] reserva atômica de inventário
- [ ] InventoryReservation e InventoryMovement
- [ ] tratamento de concorrência
- [ ] rollback completo

### Etapa 8 — Idempotência do checkout

- [ ] persistência da chave
- [ ] replay seguro
- [ ] rejeição de chave reutilizada com payload diferente

### Etapa 9 — Consultas e estados de pedidos

- [ ] visão consolidada do customer
- [ ] visão do SellerOrder
- [ ] históricos
- [ ] máquinas de estado
- [ ] ownership

### Etapa 10 — Pagamentos e reembolsos

- [ ] múltiplos PaymentAttempts
- [ ] valores em centavos
- [ ] captura total/parcial
- [ ] múltiplos refunds
- [ ] limites acumulados

### Etapa 11 — Entregas

- [ ] Delivery por SellerOrder
- [ ] histórico e máquina de estados
- [ ] remover cron do servidor HTTP

### Etapa 12 — Reviews e reputação

- [ ] alvo exclusivo produto ou seller
- [ ] unicidade e ownership
- [ ] autorização por compra concluída
- [ ] rating calculado

### Etapa 13 — Dashboards e relatórios

- [ ] agregações por SellerOrder
- [ ] valores e status do schema-v2
- [ ] paginação e filtros temporais
- [ ] eliminar N+1

### Etapa 14 — Limpeza e fechamento

- [ ] remover contratos e campos legados
- [ ] remover scripts incompatíveis
- [ ] revisar artefatos `dist/`
- [ ] executar suíte completa e smoke tests

## Próxima ação

Corrigir a implementação do filtro de disponibilidade da Etapa 2.1. Depois da validação, marcar a Etapa 2.1 como concluída e mover `[~]` para a Etapa 3.

## Protocolo de atualização

Ao concluir uma etapa:

1. executar os testes e smoke tests definidos no handoff;
2. registrar eventuais lacunas;
3. trocar sua marcação para `[x]`;
4. mover `[~]` para a próxima etapa;
5. atualizar a data no topo deste arquivo.

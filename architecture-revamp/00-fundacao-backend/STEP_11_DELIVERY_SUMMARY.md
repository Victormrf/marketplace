# Etapa 11 — Deliveries

## Objetivo

Implementar entregas independentes por `SellerOrder`, com ownership, máquina de estados, histórico transacional e um job executável fora do servidor HTTP.

## Relacionamento

```text
Order
└── SellerOrder
    └── Delivery
```

Cada `SellerOrder` pode possuir no máximo uma `Delivery`.

## Criação

1. Seller proprietário ou admin solicita a criação.
2. O backend bloqueia o `SellerOrder` com `FOR UPDATE`.
3. Valida ownership e o estado do `SellerOrder`.
4. Confirma que ainda não existe uma delivery.
5. Cria a delivery em `SEPARATED`.
6. Cria o histórico inicial na mesma transação:

   ```text
   null → SEPARATED
   ```

O lock e a unicidade garantem que duas criações concorrentes produzam somente uma delivery.

## Máquina de estados

Fluxo principal:

```text
SEPARATED
→ PROCESSING
→ SHIPPED
→ COLLECTED
→ ARRIVED_AT_CENTER
→ DELIVERED
```

Caminhos excepcionais:

```text
Estados operacionais → FAILED
FAILED              → RETURNED
DELIVERED           → RETURNED
```

Transições inválidas são rejeitadas e repetições são idempotentes.

`deliveredAt` é preenchido somente na primeira entrada em `DELIVERED`.

## Histórico e concorrência

Cada transição:

1. bloqueia a delivery com `FOR UPDATE`;
2. relê o estado atual;
3. valida a máquina de estados;
4. atualiza condicionalmente;
5. cria `DeliveryStatusHistory`;
6. confirma tudo na mesma transação.

Se a criação do histórico falhar, a alteração do status sofre rollback.

O histórico registra:

- status anterior;
- novo status;
- data da mudança;
- motivo opcional.

## Tracking

As informações de acompanhamento são:

- `trackingCode`;
- `carrier`;
- `estimatedDelivery`.

Atualizações utilizam whitelist e não criam histórico de status.

Tracking não pode ser alterado em estados finais ou incompatíveis.

## Autorização

### Leitura

- Customer proprietário da `Order`.
- Seller proprietário do `SellerOrder`.
- Admin.

### Escrita

- Seller proprietário do `SellerOrder`.
- Admin.

Customer não pode criar delivery, alterar status ou modificar tracking.

## Job independente

O cron foi removido do servidor HTTP. O job é executado separadamente:

```bash
npm run job:deliveries
```

Ele é um processo Node.js temporário:

```text
inicia
→ processa deliveries elegíveis
→ encerra
```

Não existe ainda worker permanente, fila ou outro servidor HTTP.

## Processamento em lotes

O job:

- processa lotes de até 100 registros;
- utiliza paginação keyset por `id`;
- não carrega todas as deliveries em memória;
- reutiliza service e repository;
- não atualiza Prisma diretamente;
- permite reexecução sem duplicar históricos.

## Relógio do status

A elegibilidade temporal utiliza o último:

```text
DeliveryStatusHistory.changedAt
```

Não utiliza `Delivery.updatedAt`, pois esse campo também muda quando tracking, carrier ou previsão são atualizados.

Regras simuladas:

```text
SEPARATED: pelo menos 4 horas no status
Demais estados operacionais: pelo menos 24 horas no status
```

Depois do lock, a transação confirma novamente:

- status esperado;
- último histórico correspondente ao status;
- identificador do histórico esperado;
- elegibilidade temporal.

Histórico ausente ou inconsistente impede progressão automática.

## Separação de responsabilidades

O servidor Express atende requisições HTTP. O job processa progressões simuladas de entrega em uma execução independente.

A máquina de `Delivery` não altera automaticamente o status de `SellerOrder`. Essa sincronização permanece fora do escopo atual.

## Validação final

- Build aprovado.
- Deliveries: 13 testes aprovados.
- Orders: 14 testes aprovados.
- Pagamentos: 14 testes aprovados.
- Refunds: 8 testes aprovados.
- Checkout: 15 testes aprovados.
- Banco/schema: 12 testes aprovados.
- Total: **76 testes aprovados**.

## Limites de escopo

Não foram implementados:

- integração real com transportadora;
- localização em tempo real;
- filas ou Redis;
- worker permanente;
- webhooks;
- sincronização automática com `SellerOrder`;
- refunds ou inventário automáticos por falha de entrega.

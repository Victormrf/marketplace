# Etapa 10B — Refunds

## Objetivo

Implementar refunds financeiros integrais ou parciais sobre um `PaymentAttempt` capturado, com suporte a múltiplas operações sem permitir que o valor acumulado ultrapasse o pagamento original.

## Relacionamento atual

```text
Refund → PaymentAttempt → Order
```

O refund não possui relação estruturada com produto, `OrderItem`, `SellerOrder` ou seller. O campo `reason` pode registrar informalmente o motivo, mas não permite métricas confiáveis por produto ou seller.

## Fluxo principal

1. Customer proprietário ou admin solicita o refund.
2. O backend bloqueia o `PaymentAttempt` com `FOR UPDATE`.
3. Confirma que o pagamento está `CAPTURED`.
4. Calcula o saldo ainda reembolsável.
5. Cria o refund como `REQUESTED`.
6. Altera o refund para `PROCESSING`.
7. Chama o provider fora da transação do banco.
8. Salva a referência externa.
9. Finaliza o refund como `COMPLETED`.

## Controle do valor acumulado

Os seguintes estados comprometem o saldo:

```text
REQUESTED
PROCESSING
COMPLETED
```

O cálculo utilizado é:

```text
saldo reembolsável = valor capturado - refunds comprometidos
```

Refunds em `DECLINED` ou `FAILED` deixam de comprometer o saldo.

O lock no `PaymentAttempt` garante que solicitações concorrentes não ultrapassem o valor capturado.

## Máquina de estados

```text
REQUESTED  → PROCESSING
PROCESSING → COMPLETED
PROCESSING → DECLINED
PROCESSING → FAILED
```

`COMPLETED`, `DECLINED` e `FAILED` são estados finais.

Repetir a mesma transição é idempotente e não deve duplicar efeitos.

## Provider e idempotência

Foi criado um provider simulado de refund. A referência externa é determinística pelo `refundId`:

```text
refundId → providerReference
```

Reconciliar o mesmo refund reutiliza o mesmo `refundId` e representa a mesma operação lógica no provider.

O provider é chamado fora da transação para não manter conexões e locks do PostgreSQL durante operações de rede.

## Tratamento de falhas

- **Refund recusado:** muda para `DECLINED` e libera o saldo.
- **Falha técnica definitiva:** muda para `FAILED`, preenche `failedAt` e libera o saldo.
- **Resultado desconhecido:** permanece `PROCESSING` e mantém o saldo comprometido.
- **Erro genérico:** recebe o tratamento conservador de resultado desconhecido.
- **Falha ao salvar a referência:** permite reconciliar o mesmo refund posteriormente.

As classes de erro do provider são verificadas com `instanceof` e podem preservar a causa original em `cause`.

## Autorização

- Customer pode solicitar e consultar refunds associados às próprias orders.
- Admin pode solicitar e consultar refunds.
- Seller não recebe acesso direto aos refunds financeiros da order.
- Não existe endpoint público para alteração arbitrária de status.
- Refunds não podem ser excluídos fisicamente.

## Consultas

Foram implementadas consultas por refund e por `PaymentAttempt`, com:

- paginação;
- filtros aplicados antes da paginação;
- filtro por status e período;
- ordenação determinística;
- DTOs explícitos.

## Validação

- Build aprovado.
- Suíte de refunds: 8 testes aprovados.
- Regressões de pagamentos, orders, checkout e banco aprovadas.

## Limites de escopo

Não foram implementados:

- refunds por produto ou quantidade;
- vínculo direto com `SellerOrder` ou seller;
- retorno automático ao inventário;
- integração com logística;
- gateway financeiro real;
- filas ou workers.


# Etapa 10A — Pagamentos

## Objetivo

Implementar um fluxo simplificado de pagamento integral para cada `Order`, preparando o backend para uma futura integração com um gateway real.

## Fluxo principal

1. O cliente solicita o pagamento informando apenas o método.
2. O backend obtém o valor e a moeda diretamente da `Order`.
3. Um `PaymentAttempt` é criado com status `CREATED`.
4. O provider é chamado fora da transação do banco.
5. A `providerReference` retornada é vinculada à tentativa.
6. A tentativa percorre a máquina de estados:

   ```text
   CREATED → PROCESSING → AUTHORIZED → CAPTURED
   ```

7. A captura integral confirma a `Order`.

## Regras implementadas

- O cliente não pode definir o valor da cobrança.
- O pagamento sempre corresponde ao valor integral da `Order`.
- Pagamentos parciais não são permitidos.
- Apenas uma tentativa ativa ou capturada pode existir por vez.
- Tentativas `FAILED` ou `CANCELLED` permitem uma nova tentativa.
- A captura e a confirmação da `Order` acontecem atomicamente.
- Callbacks repetidos são tratados de forma idempotente.
- Operações concorrentes são serializadas por lock na `Order`.

## Integração com o provider

Foi criada a abstração `PaymentProvider`, atualmente implementada pelo `DevPaymentProvider`.

Cada tentativa recebe uma referência externa determinística:

```text
PaymentAttempt.id → providerReference
```

Repetir a operação para o mesmo `PaymentAttempt` retorna a mesma referência, evitando uma segunda cobrança lógica.

O provider é chamado fora da transação para que uma operação de rede lenta ou indisponível não mantenha transações, conexões e locks do PostgreSQL abertos.

## Tratamento de falhas

- **Falha definitiva:** a tentativa muda para `FAILED` e uma nova tentativa pode ser criada.
- **Resultado desconhecido**, como timeout: a tentativa permanece `CREATED`, impedindo outra cobrança até a reconciliação.
- **Falha ao salvar a referência:** a tentativa permanece recuperável.
- A reconciliação reutiliza o mesmo `PaymentAttempt` e o mesmo `paymentAttemptId`.
- Erros não classificados recebem o tratamento conservador de resultado desconhecido.

## Segurança e acesso

- Apenas o customer proprietário acessa suas tentativas.
- Admin pode consultar tentativas.
- Seller não recebe acesso direto ao pagamento completo.
- Campos protegidos, como valor e status, não podem ser definidos pelo cliente.
- As antigas rotas de refund foram temporariamente desativadas.

## Validação final

- Build aprovado.
- Pagamentos: 14 testes aprovados.
- Orders: 14 testes aprovados.
- Checkout: 15 testes aprovados.
- Banco/schema: 12 testes aprovados.
- Total: **55 testes aprovados**.

## Dívida técnica registrada

O nome do provider ainda é inicialmente definido como `DEV_SIMULATOR`. Essa configuração deverá ser generalizada antes da integração com diferentes gateways reais.

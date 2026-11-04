# Etapa 7.1 — preparação da progressão de deliveries para fila

Concluída em 03/11/2026. Descoberta e processamento separados, sem instalar
BullMQ/Redis nem iniciar worker. Próxima etapa: **7.2**.

## Contrato v1

```ts
type DeliveryProgressionJob = {
  version: 1;
  deliveryId: string;
  expectedStatus:
    | "SEPARATED"
    | "PROCESSING"
    | "SHIPPED"
    | "COLLECTED"
    | "ARRIVED_AT_CENTER";
  expectedHistoryId: string;
  eligibleBefore: string;
};
```

A entrada do consumidor aceita unknown e valida versão, campos exatos, status,
identificadores não vazios (até 255 caracteres, sem espaços/controles) e data
ISO UTC canônica, produzida por Date.toISOString(). Datas inexistentes,
campos extras e payloads inválidos geram ValidationError antes de consultar o
service. Não transporta DTO, endereço, identidade do usuário ou tracking.

Identidade determinística: delivery-progression-v1- + SHA-256 do par JSON
[deliveryId, expectedHistoryId]. Mesmo histórico produz a mesma identidade,
mesmo em descobertas com cutoffs diferentes; novo histórico produz outra.
O formato não contém dois-pontos. A identidade será usada na futura fila;
**não substitui o lock e a validação atômica no PostgreSQL**, nem garante execução
exatamente uma vez ou deduplicação eterna após remoção de jobs da fila.

## Responsabilidades e garantias

- discoverDeliveryProgressionJobs: async generator, páginas de 100 registros,
  keyset id ASC, sem acumular o dataset inteiro. Reutiliza findForJob e o último
  histórico carregado com changedAt DESC, id DESC. Ignora histórico ausente,
  divergente ou estados sem progressão. Não executa transições.
- Elegibilidade: último histórico de status com changedAt <= cutoff; 4 h em
  SEPARATED, 24 h nos outros quatro estados automáticos. updatedAt e tracking
  não definem esse relógio. O relógio pode ser fornecido nos testes.
- processDeliveryProgressionJob: valida o contrato e chama advanceForJob uma
  única vez com ID, status, histórico e cutoff esperado. Limita o cutoff ao
  menor entre o recebido e agora menos 4/24 h: mensagem não autoriza antecipar
  progressão; uma mensagem atrasada não amplia seu cutoff original.
- DeliveryService continua responsável pelo próximo estado; repository mantém
  SELECT FOR UPDATE, releitura, validação de status/último histórico/prazo,
  update condicional e inserção do histórico na mesma transação. Não houve
  mudança de máquina, locks, ownership ou contratos HTTP.
- updateDeliveryStatuses: compõe diretamente descoberta e processamento,
  sequencialmente. job:deliveries permanece o executor independente atual,
  com disconnect ao terminar, sem publicação em fila nem dependência de HTTP.

| Resultado | Representação e tratamento |
| --- | --- |
| Aplicado | outcome: applied, somente após retorno da transação do service. |
| Ignorado | outcome: ignored para null do service (ausente/obsoleto/inapto) ou DeliveryConcurrentChangeError da atualização condicional. Não deve gerar retry. |
| Falha | Promise rejeitada com o erro original; não é transformada em sucesso/ignored. O executor para, sem retry próprio. |

DeliveryConcurrentChangeError herda ConflictError e preserva sua mensagem HTTP.
Apenas esse conflito conhecido de corrida é ignorado. Outros ConflictError,
mesmo com o mesmo texto, continuam propagados para investigação; não se presume
que sejam erros técnicos ou obsolescência pela mensagem. Payload inválido é
rejeição de contrato, não falha técnica transitória: a política terminal da fila
será definida em 7.2. Uma entrega aplicada produz novo histórico e exige outra
mensagem e nova espera antes da etapa seguinte.

## Direção para 7.2 e 7.3

```text
Descoberta periódica → fila → worker Node → service → repository/PostgreSQL
```

**7.2: BullMQ + Redis.** Direção escolhida para integrar mensagens JSON ao Node,
com controle de execução, retries/backoff e concorrência limitada. Redis manterá
a fila e seus estados, não substituirá PostgreSQL como autoridade do domínio.
O worker será processo independente, sem servidor HTTP obrigatório. Instalação,
versões, conexões, durabilidade/retenção do Redis, agendamento, desligamento,
tratamento de payload inválido e limites operacionais ficam para essa etapa.
Entregas podem se repetir: perda de confirmação ou reinício exige consumidor
seguro, não promessa de exatamente uma vez.

**7.3:** testar a ausência de efeitos duplicados e publicação confiável diante de
falhas entre persistência e envio, avaliando outbox conforme o fluxo real.
Manter as proteções PostgreSQL; jobId isolado não resolve o problema de publicação.

Referências: [identidade de jobs](https://docs.bullmq.io/guide/jobs/job-ids),
[retries/backoff](https://docs.bullmq.io/guide/retrying-failing-jobs) e
[concorrência](https://docs.bullmq.io/guide/parallelism-and-concurrency).

## Validação e limites

Executados em nodejs-backend: npx.cmd tsc --noEmit, npm.cmd run build e
npm.cmd run test:delivery-progression: **20/20 aprovados**. A suíte foi incluída
em run-all-tests.js. Dist foi gerado exclusivamente pela build.

Cobertura: contrato/identidade, limites de tempo exatos e 1 ms antes, histórico
consistente, tracking recente sem reiniciar relógio, descoberta paginada/lazy de
205 registros, mensagens atrasadas/futuras, uma chamada de service, cada passo
real da máquina, mensagens duplicadas, status/histórico obsoletos após lock,
atualização condicional, propagação de falhas e reutilização pelo executor.

As operações Prisma são substituídas por doubles com guarda contra acesso real.
O double de transação serializa chamadas e simula rollback: esses testes não são
nova prova de concorrência/rollback no PostgreSQL. A transação existente foi
preservada; integração PostgreSQL não foi repetida, evitando executar o job sobre
entregas preexistentes da base. Nenhum job real, banco, fixture persistente,
container, carga, purge, alteração de schema/migration ou commit nesta entrega.

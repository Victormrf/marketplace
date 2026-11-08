# Etapa 7.3 — duplicatas e recuperação da progressão de deliveries

Concluída em **08/11/2026**, com Redis e PostgreSQL reais e fixtures exclusivas.
Preservados contrato v1, regras de progressão, transações, schema e migrations.

## Garantia e decisão

Não foi adicionada outbox: elegibilidade e histórico continuam no PostgreSQL,
sem marca de publicação. Uma nova execução explícita da descoberta recupera
publicações ausentes, com identidade determinística enquanto retida no Redis.
Não há scheduler permanente nem atomicidade PostgreSQL/Redis.

Lock/releitura de status, histórico e tempo, seguidos de atualização/histórico
atômicos, tornam uma mensagem antiga ignored após commit. Isso também funciona
com dois workers, IDs de fila diferentes ou remoção do job anterior. Não significa
processamento exatamente uma vez. Outbox será necessária se surgir intenção de
evento obrigatório que não possa ser reconstruída pela consulta atual.

## Evidências

- Publicação parcial e resposta perdida: redescoberta recuperou os candidatos,
  sem criar identidades adicionais enquanto os jobs estavam retidos.
- Dois workers processaram expectativas equivalentes: applied + ignored, um
  único histórico adicional. Mensagem antiga republicada após remoção apenas
  do próprio job de teste também resultou em ignored.
- Processo filho interrompido após commit visível por leitura independente e
  antes do ack Redis: recuperação stalled real executou novamente e ignorou
  a mensagem antiga, sem nova transição/histórico.
- Falha dentro da transação antes do histórico fez rollback completo, inclusive
  updatedAt. Failed retido não reiniciou por descoberta. Após decisão manual
  controlada de retry e remoção da falha de teste, a transição foi aplicada.

## Implementação e validação

Publisher registra identidade segura em falha de publicação. Inspeção read-only
por jobId mostra estado, tentativas e outcome/código sanitizado. O comando
`queue:deliveries:status -- --job <id>` não publica e recusa IDs inválidos.
Instruções e limites: [DELIVERY_QUEUE.md](nodejs-backend/docs/DELIVERY_QUEUE.md).

Typecheck e build aprovados. Testes: progressão **20/20**, fila **11/11**,
integração fila **7/7**, recuperação **5/5**: **43/43 aprovados**. CLI retornou
missing corretamente. Fixtures ausentes e Redis DB 15 vazio conferidos por leitura.
Timers de lease reduzidos apenas no teste; nenhuma chave operacional de falha.

Todos os workers/processos filhos foram encerrados. Redis e PostgreSQL, parados
no início e iniciados para validar, foram encerrados; volumes preservados. Sem
descoberta global, carga, escala, flush ou mudanças em outros domínios.

## Limites

Recuperação exige PostgreSQL, Redis e nova execução do publisher disponíveis.
Completed/failed retidos podem impedir nova inclusão; investigar falhas terminais
antes de retry manual. Redis/AOF não substitui o histórico de negócio nem garante
perda zero. Nenhuma DLQ ou expansão da 7.4 foi iniciada; próxima decisão depende
de revisão explícita do responsável.

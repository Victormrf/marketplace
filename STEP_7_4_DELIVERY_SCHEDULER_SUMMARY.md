# Etapa 7.4 — descoberta periódica de deliveries

Concluída em **08/11/2026**. Fase 7 encerrada para este fluxo; próxima etapa:
**8.1 — escolha do primeiro endpoint para cache**. Outros consumidores continuam
possibilidades futuras, sem implementação automática.

## Fluxo e responsabilidades

Job Scheduler BullMQ → fila delivery-discovery → worker de descoberta → consulta
paginada → publicação sequencial → fila delivery-progression → worker de
progressão → service/PostgreSQL. Contrato de descoberta somente `{ version: 1 }`;
não transporta deliveries, dados pessoais ou consulta arbitrária.

Identidade estável delivery-discovery-v1, intervalo padrão cinco minutos,
mínimo operacional um minuto e máximo 24 horas. API e workers não registram o
scheduler ao iniciar. Concorrência global Redis 1 limita consumidores de
descoberta em processos distintos. Reutilizados contrato de progressão, clocks,
locks, classificação segura, três tentativas limitadas, retenção e shutdown.

Operação documentada em [DELIVERY_QUEUE.md](nodejs-backend/docs/DELIVERY_QUEUE.md):
scripts schedule:deliveries:configure/status/remove e worker:deliveries:discovery;
worker:deliveries continua responsável por avançar uma delivery de cada vez.

## Evidências

- Registrar duas vezes manteve um scheduler e atualizou o intervalo.
- Ocorrência real percorreu descoberta restrita, publicação e progressão real:
  SEPARATED → PROCESSING e somente um histórico adicional no PostgreSQL dev.
- Duas instâncias, com a primeira bloqueada por barreira, respeitaram concorrência
  global 1; ambas concluíram sem descobertas simultâneas.
- Ausência temporária de consumidores por vários intervalos não acumulou todos
  os ticks; consumo posterior e remoção explícita foram conferidos.
- Publicação parcial falhou terminalmente nessa ocorrência; uma próxima
  recorrência recuperou candidatos e deduplicou identidades retidas, sem retry
  automático do failed anterior.
- CLI configurar/consultar/remover funcionou em prefixo próprio. Scheduler
  removido não apagou uma ocorrência já waiting, conforme esperado.

Typecheck e build aprovados. Descoberta **6/6** unitários e **5/5** integração;
regressões: progressão **20/20**, fila **11/11**, integração fila **7/7**,
recuperação **5/5**, logging **20/20**: **74/74 aprovados**. Bloqueio EACCES
inicial do logging no sandbox foi resolvido executando a suíte com loopback
permitido; não foi alteração de código funcional.

Testes usam Redis real DB 15/prefixos exclusivos, dependências de descoberta
restritas às fixtures e guardas de identidade do PostgreSQL local. Sem descoberta
global. Agendamentos/filas e grafo próprio removidos; workers/clientes encerrados.
Redis e PostgreSQL estavam parados e foram iniciados só para validar: encerrados
ao final, sem remover volumes, alterar schema, acessar escala ou executar carga.

## Consumo e limites

Amostra local: Redis 8,3 MiB/192 MiB, PostgreSQL 35,6 MiB e aproximadamente
529 MiB livres no Windows. Fotografias do ambiente compartilhado, não picos ou
benchmark. A última integração levou aproximadamente seis segundos.

Não há garantia de horário exato, compensação de cada intervalo perdido ou
exatamente uma vez. Lease/reentrega continuam exigindo a proteção PostgreSQL.
Remover scheduler impede futuras ocorrências; parar worker interrompe consumo;
jobs já publicados permanecem. Failed exige investigação. Não há cancelamento
global, retry terminal automático, DLQ, painel ou novos domínios. A indisponibilidade
testada foi ausência temporária de consumidores, não todas as falhas possíveis
do Redis/host; AOF não garante perda zero.

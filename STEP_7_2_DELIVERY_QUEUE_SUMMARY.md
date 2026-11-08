# Etapa 7.2 — fila de progressão de deliveries

Concluída em 05/11/2026. Próxima: **7.3**, sem iniciá-la.

- BullMQ 5.81.5/ioredis 5.11.1; Redis 7.4.2-alpine em Compose independente,
  loopback:6381, AOF everysec, noeviction, maxmemory 64 MiB e container 192 MiB.
  Volume próprio estável marketplace-delivery-redis-data em /data.
- Publisher sequencial reutiliza descoberta v1 e ID determinístico, aguarda add,
  para na falha e encerra conexões. Sem scheduler permanente ou descoberta real
  sobre as deliveries existentes durante validação.
- Worker Node independente sem HTTP reutiliza processDeliveryProgressionJob;
  valida nome/payload, concorrência 1 (configurável 1–4), 3 tentativas totais e
  backoff exponencial 1 s/2 s. applied/ignored concluem; inválido/desconhecido/
  conflito inesperado são terminais; apenas códigos Prisma tipados reconhecidos
  recebem retry. Falhas esgotadas permanecem failed.
- Retenção limitada de concluídos/falhos/eventos; logs JSON com allowlist e
  erros sanitizados também para armazenamento BullMQ, preservando cause em
  memória. Shutdown com prazo e registro explícito de encerramento incompleto.
- Comandos distintos: job:deliveries direto; job:deliveries:publish;
  worker:deliveries; queue:deliveries:status. Build única antes dos novos comandos.
  Não operar modo direto e fila simultaneamente no uso normal.
- Validações finais: typecheck/build; 7.1 **20/20**, unitários fila **9/9**,
  integração real **7/7**, logging **20/20** — **56 testes aprovados**.
- Redis real em DB 15 e prefixos exclusivos: deduplicação retida, sucesso,
  ignored, inválidos sem retry, transitório recuperado e esgotamento comprovados.
  Uma fixture mínima no PostgreSQL dev foi publicada individualmente: SEPARATED
  → PROCESSING e um histórico adicional. Grafo removido com filtros/vínculos;
  DB 0/15 vazios e fixture ausente ao final. Nenhum dado do seed usado como fixture.
- CLI independente iniciou/parou por SIGINT; falha Redis local gerou saída 1
  segura. Redis ~9,3 MiB de RAM e /data ~300 KiB alocados em amostras. Serviços
  iniciados encerrados, volume preservado e PostgreSQL preexistente ativo.
- Limites: AOF não garante perda zero; retenção não é deduplicação eterna;
  nenhuma garantia exatamente uma vez. Publicação confiável/outbox, interrupções
  e proteção aprofundada contra efeitos duplicados ficam para 7.3. Sem schema,
  migration, carga, banco de escala, observabilidade nova ou commit.

[Operação, parâmetros, arquivos e evidências](nodejs-backend/docs/DELIVERY_QUEUE.md).

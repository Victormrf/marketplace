# Etapa 6.3 — tracing, saúde e painéis locais

**Concluída em 02/11/2026**, após a demonstração integrada antes bloqueada pelo
Docker. A fase 6 está concluída no escopo local acordado; próxima etapa 7.1.

- OpenTelemetry/OTLP manual somente nas entradas de listagem do catálogo.
  HTTP → service → repository → chamadas reais Prisma; sem SQL/parametrização,
  payloads ou erros brutos. traceId/spanId nos logs junto ao requestId.
- /health/live sem banco e /health/ready READ ONLY com timeout, cache breve e
  single-flight. Ambos retornaram 200 no PostgreSQL local marketplace_dev:5433.
- Três listagens sequenciais reais retornaram 200 (dois itens, total três).
  Trace de oito spans conferido no Tempo e no Grafana Explore, correlacionado
  ao log HTTP; persistiu após reiniciar Tempo. Prometheus UP e coleta PostgreSQL
  up=1. Dashboard de dez painéis carregado via Playwright, todas as consultas
  200; sem erros de console na navegação final, p95 sem amostras corretamente.
- Tempo parado isoladamente: duas novas listagens 200 e readiness 200; falha do
  exportador não derrubou a API. Falha do banco/timeout preservados nos testes
  isolados, sem parar PostgreSQL compartilhado.
- Correções operacionais comprovadas: IPs fixos dos três serviços; pré-instalação
  e carregamento do plugin Loki não usado desabilitados; stream_over_http_enabled
  no Tempo para compatibilidade do cliente de consulta Grafana.
- Validação final: TypeScript/build, tracing/health **11/11**, métricas **15/15**,
  logging **20/20**, Compose config e promtool check config aprovados.
- Observações locais: Prometheus ~20–27 MiB, Grafana ~74–98 MiB, Tempo ~26–42 MiB;
  API ~83 MiB RSS. Menor amostra de memória livre Windows ~307 MiB: não é margem
  para novas cargas nem medição isolada de overhead. Diretórios dos três volumes
  somaram ~30,1 MiB alocados, excluindo imagens/VM/disco virtual compartilhado.
- API de demonstração, coletores, exportador, browser e stack iniciados foram
  encerrados; volumes próprios preservados e PostgreSQL preexistente ativo.
  Nenhuma escrita de negócio, fixture, carga, purge, produção ou ticket de escala.

Instruções, limitações, evidência de correlação, medidas e comandos centralizados
em [OBSERVABILITY_LOCAL.md](nodejs-backend/docs/OBSERVABILITY_LOCAL.md).
A conexão Docker foi observada como loopback neste host; exceção remota por IP
exato + segredo validada por doubles. Sem tracing Next/BFF, Loki ou observabilidade
de filas fictícia. Pendências transversais preservadas; fase 7 não iniciada.

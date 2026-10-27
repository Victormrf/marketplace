# Etapa 5.2 — Baseline exploratória mínima concluída

## Fechamento em 26/10/2026, horário de São Paulo

Quatro experimentos reais aprovados uma vez cada, usando Node HTTP e API compilada 8051 sobre `marketplace_scale` small. Autorização direta retirou o piso mínimo de RAM exclusivamente deste perfil; medição e guardas de CPU sustentada/disco/duração preservadas. Nenhum retry ou cenário adicional.

| Atividade              | Implementada/testada | Executada realmente                                 | Resultado                                                      |
| ---------------------- | -------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Produto popular        | Sim                  | Cinco GETs seriais                                  | 5/5 corretos; mediana 12,240 ms                                |
| Summary seller high    | Sim                  | Cinco GETs seriais                                  | 5/5 corretos; mediana 11,789 ms                                |
| Checkout compartilhado | Sim                  | Duas chamadas sobrepostas, dois customers/estoque 1 | Um pedido, um conflito exato de estoque, uma reserva/movimento |
| Idempotência           | Sim                  | Duas chamadas sobrepostas, mesma chave/payload      | Uma criação e um replay integralmente idêntico; efeitos únicos |
| Recuperação em escala  | Sim                  | Explicitamente após cada escrita                    | Ambos os grafos removidos; baselineIntact=true                 |

Leituras: 4,138/4,128 s incluindo quatro pausas de 1 s; 1,208/1,211 requests/s. Checkouts: 112,614/97,624 ms; 17,760/20,487 requests/s. Zero erros técnicos, desconhecidos ou interrupções. Poucas amostras: referência exploratória, sem conclusão de capacidade/cauda.

Oráculos SQL corretos; assinaturas das 22 tabelas preservadas. Recuperação confirmou os **30.349 registros históricos e 18 invariantes**; manifesto final RECOVERED, dois tickets de escrita persistentes e nenhuma fixture de negócio restante. Sem purge ou geração.

RAM inicial 4,607 GiB, mínima amostrada 4,013 GiB. Não prova que qualquer quantidade de RAM seria suficiente. Coleta periódica até 1,435 ms; detalhes 3,027–3,601 s antes/depois, fora da janela. CPU do produto ultrapassou 85% somente por 100 ms; idempotência teve uma amostra, sem intervalo CPU. Limitações de atribuição por processo/SQL lento registradas no relatório.

Banco 24.321.047 → 24.542.231 bytes; PGDATA 81.399.808 → 81.620.992 bytes, incluindo WAL 33.562.624. Windows C: com aproximadamente 58,86 GiB livres. VHDX compartilhado não é tamanho exclusivo do dataset. Volume/dados preservados, API e container próprios encerrados, serviços preexistentes mantidos.

Validação desta entrega: **28 testes puros aprovados** (baseline 18, reference 3, mínimo 7), typecheck e build, fora das medições. Três testes dedicados PostgreSQL da entrega anterior permanecem evidência aprovada. Guarda reference de serve/sessions corrigida; piso zero e guarda explícita têm regressões. K6 inspect passou removendo SSLKEYLOGFILE somente do processo de teste, sem configuração global.

**5.2 concluída no escopo mínimo aprovado; próxima 5.3.** Perfil suspenso e tickets consumidos. Não executar outros estágios automaticamente. Detalhes/artefatos em `nodejs-backend/docs/LOAD_BASELINE_REPORT.md`; comandos centralizados em `LOAD_TEST_PLAN.md`. Sem schema/migrations/produção/commit. Pendências transversais preservadas.

## Histórico abaixo — bloqueio anterior superado

## Escopo e execução por fases

Referência **exploratória mínima**, sem buscar capacidade, estresse ou percentis confiáveis. Leituras: Node HTTP nativo, 1 usuário, cinco GETs seriais no mesmo produto/summary, pausa de 1 s; checkouts: duas chamadas coordenadas sem pausa. Teto de 60 s, timeout de 10 s, sem retries. Guarda emergencial de **512 MiB antes/durante**, explicitamente autorizada e confirmada no chat; CPU sustentada e armazenamento preservados.

| Atividade                          | Implementada/testada            | Executada realmente             | Resultado                                               |
| ---------------------------------- | ------------------------------- | ------------------------------- | ------------------------------------------------------- |
| Build/typecheck e testes sem banco | Sim                             | Sim, em fases separadas         | Aprovados                                               |
| Fixtures dedicadas e falha parcial | Sim                             | Sim, marketplace_load_test:5436 | Três testes PostgreSQL aprovados; recuperação explícita |
| Produto popular em escala          | Harness Node e helpers testados | Não                             | RAM abaixo de 512 MiB antes do banco                    |
| Dashboard summary em escala        | Harness Node e helpers testados | Não                             | Escala bloqueada, sem insistência                       |
| Checkout compartilhado em escala   | Testado no dedicado             | Não                             | Nenhuma fixture preparada em escala                     |
| Idempotência em escala             | Testada no dedicado             | Não                             | Nenhuma fixture preparada em escala                     |

## Evidências independentes concluídas

- **53 testes sem banco**: plano 8, supervisor 18, cenários simulados 11, executor 5, recursos 2, reference puros 3, mínimo 6. Incluem guarda emergencial, CPU sustentada, coleta sem subprocessos/SQL e rejeição de replay divergente.
- **3 testes PostgreSQL antes pendentes aprovados**, um por vez, usando só o banco dedicado/API 8052: compartilhado com dois customers e estoque 1 produziu um pedido/um conflito correto/uma reserva; idempotência produziu uma criação/um replay e efeitos únicos; falha parcial commitada ficou UNKNOWN até recuperação explícita.
- Memória dedicada: 1067,1 MiB com seus processos parados; 987,2 após PostgreSQL; 832,1–849,6 após API. Coleta mínima custou até 0,791 ms; detalhes de armazenamento 2,717–2,812 s fora da janela HTTP.
- Testes HTTP duraram cerca de 106 e 84 ms, com somente duas/uma amostras. Não sustentam estatística ou atribuição de CPU por processo; nenhuma CPU inferida como zero quando não existe intervalo.
- Após cada teste, grafos recuperados e assinaturas históricas iguais. Estado final dedicado RECOVERED, somente usuário sentinela histórico, zero Orders/reservas experimentais; container/API próprios encerrados.
- npx.cmd tsc --noEmit e npm.cmd run build aprovados antes do banco. Nenhuma instalação/download durante experimentos; k6 inspect ocorreu apenas como validação estática anterior.

## Bloqueio exato e intervenção necessária

Na fase seguinte, a pré-verificação de escala registrou **513.331.200 bytes = 489,6 MiB**, abaixo dos 536.870.912 exigidos, **antes de iniciar o PostgreSQL e a API de escala**. A carga não foi tentada nem repetida. Não deixar recursos próprios ligados para aguardar: todos encerrados.

Falta o responsável disponibilizar RAM no host para sustentar >=512 MiB **após** iniciar PG/API, com margem para variabilidade, reduzindo voluntariamente uso de aplicativos que escolher ou usando outro host. Nenhum aplicativo/serviço preexistente foi encerrado; nenhuma alteração global/Docker/pagefile/durabilidade.

As contagens/invariantes atuais do small não foram reconfirmadas com o banco parado. Nenhuma fixture de escala criada, recuperação pendente ou dado histórico alterado nesta entrega. Sem desenvolvimento/E2E/produção, geração, medium/large ou purge.

## Estado e retomada

**5.2 parcial por ambiente, não concluída.** Implementação, preparação e testes dedicados não estão mais pendentes. Não repetir ciclo de planejamento: resolver margem de memória e retomar apenas os quatro experimentos, uma vez cada. Após cada escrita bem-sucedida, reconciliar e recuperar explicitamente o grafo e comprovar integridade histórica. Perfil suspenso para impedir tentativas silenciosas.

A 5.3 continua sendo análise curta de resultados, limitações e repetições após melhorias; nenhum gargalo/otimização é obrigatório agora. Operação centralizada em `nodejs-backend/docs/LOAD_TEST_PLAN.md`; IDs e detalhes em `nodejs-backend/docs/LOAD_BASELINE_REPORT.md`. Relatórios/memória ficam ignorados pelo Git, sem cookies/tokens/bodies por request. Sem commit ou alterações de schema/migrations.

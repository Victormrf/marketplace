# 5.3 — Análise da baseline exploratória

26/10/2026. Fonte: [relatório da 5.2](LOAD_BASELINE_REPORT.md), seção de fechamento e quatro agregados Node HTTP nela identificados. Números conferidos nos JSONs locais; nenhuma nova execução ou consulta ao banco nesta análise.

## Resultado observado

| Experimento real                            | Evidência                                                                                                           | Interpretação restrita                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Produto popular                             | Cinco respostas válidas pelo oráculo SQL; mediana **12,24 ms**, mínimo 10,54 e máximo 83,12 ms                      | O produto foi consultado corretamente nas cinco chamadas observadas  |
| Dashboard summary do seller de maior volume | Cinco respostas válidas; mediana **11,79 ms**, mínimo 10,74 e máximo 67,95 ms                                       | A agregação correspondeu ao oráculo no seller e período selecionados |
| Checkout compartilhado                      | Duas chamadas sobrepostas, uma criação e um conflito esperado de estoque; uma reserva/movimento e saldo consistente | A disputa observada por uma unidade não vendeu estoque excedente     |
| Idempotência                                | Duas chamadas sobrepostas com a mesma identidade/chave/payload; uma criação e um replay integralmente idêntico      | Houve um único pedido e efeitos persistidos únicos nessa execução    |

Não houve erros técnicos ou respostas desconhecidas nas rodadas. Após cada escrita houve recuperação explícita do grafo experimental; o relatório registra assinaturas das **22 tabelas**, **30.349 registros históricos** e **18 invariantes** preservados. O artefato final de recuperação confirma `RECOVERED` e `baselineIntact=true`; o status final do gerador continua `completed`. Os agregados de escrita terminam em `completed-awaiting-explicit-recovery` porque foram emitidos antes dessa operação separada: não devem ser lidos isoladamente como recuperação pendente.

## Hipóteses e limites

**Hipótese a investigar:** a primeira chamada mais lenta pode envolver inicialização/conexões ou efeitos do ambiente. Isso não foi isolado experimentalmente; não atribuir a diferença ao banco, cache ou código específico. Também não interpretar a pequena diferença entre medianas de produto e summary como vantagem estável de um endpoint.

**Limitações:** dataset `small`, máquina compartilhada e somente cinco leituras por endpoint. As leituras são seriais, com quatro pausas de 1 s; seus cerca de 1,21 requests/s descrevem o ritmo imposto pelo executor, não capacidade máxima. As duas chamadas de cada checkout demonstram o resultado observado, não resistência sustentada sob concorrência ou todas as interleavings possíveis. Percentis de cauda não são conclusivos com esse número de amostras.

Não há tracing nem atribuição detalhada do tempo entre API e banco; amostras de CPU/memória do host não representam consumo exclusivo dos processos. A janela da idempotência teve somente uma amostra de recursos, sem intervalo CPU. Não existe evidência suficiente para declarar um gargalo ou justificar uma otimização específica. Os números pertencem ao **harness Node**, sem combinação com medições anteriores do k6. A retirada excepcional do piso de RAM foi uma autorização delimitada, não autorização genérica para execuções futuras; perfis permanecem suspensos e tickets consumidos.

## Reutilização nas próximas fases

| Estratégia                | Experimento a reutilizar                   | O que comparar                                   |
| ------------------------- | ------------------------------------------ | ------------------------------------------------ |
| Observabilidade           | Produto, dashboard e checkout              | Etapas internas, consultas, erros e tempo gasto  |
| Cache                     | Produto popular                            | Latência, acertos e consultas evitadas           |
| Filas/workers             | Novo cenário específico do job de delivery | Processamento, retries, duplicatas e recuperação |
| Concorrência/idempotência | Os dois checkouts existentes               | Integridade e ausência de efeitos duplicados     |

Essa tabela é um plano de comparação, não autorização de execução nem implementação agora. Não é necessário adotar todas as estratégias ou aumentar o dataset antes de haver uma pergunta concreta. O cenário de job é futuro: as medições atuais não cobrem processamento assíncrono.

Para comparar mudanças, preservar executor/versão, entradas, produto/seller/período, dataset, configuração, pausas, limites e condições do host tão semelhantes quanto possível. Nas escritas, recriar somente o grafo experimental equivalente, com nova autorização e identidade própria; nunca reutilizar tickets consumidos. Registrar mudanças de ambiente e separar preparação, aquecimento quando aplicável, janela medida, verificação e recuperação. Um futuro aquecimento deve ser explicitado: a referência atual não teve GET adicional de aquecimento.

**Próximo aprendizado prático: 6.1 — logs estruturados e request/correlation ID**, para correlacionar entrada e resultado sem registrar segredos. Isso prepara a investigação de tempos internos nas instrumentações seguintes; logs com ID, sozinhos, não substituem tracing. Fase 5 encerrada no escopo exploratório reduzido aprovado, sem novas cargas, fixtures, otimizações ou ampliação da matriz.

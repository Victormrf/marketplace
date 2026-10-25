# Planejamento dos testes de carga — 5.1

## Autorização atual — 25/10/2026

Somente para smokes de leitura: exigir **1,25 GiB (1.342.177.280 bytes) disponíveis com API, banco e observador iniciados**, interrompendo abaixo de **1 GiB**. Para baixa, gradual e escritas, permanece o mínimo original de **2 GiB**. Esses são limites de RAM do host; a margem de espaço livre Windows da política de armazenamento não mudou. CPU >85% por 15 s, timeout HTTP 10 s, orçamento de disco, conexões/locks e duração máxima permanecem inalterados.

Estão autorizados apenas smokes de catálogo, produto e dashboard: **1 VU, 5 operações por rodada**, um cenário/variante/endpoint/seller por vez, sem escritas. Conferir resultado, oráculo, integridade e recursos antes de escolher manualmente o próximo. Baixa/gradual e qualquer escrita sobre escala continuam bloqueados. Não repetir uma falha automaticamente; mesmo falhas de preparação ficam registradas e exigem decisão explícita.

O coletor anterior chegou a **7,381 s**. Agora a configuração estática é lida uma vez, fora da janela; a API envia CPU/RSS/heap por IPC a cada segundo e um único processo `docker stats` transmite métricas continuamente. A coleta periódica combina esses dados com uma consulta PostgreSQL limitada e espaço livre Windows via API nativa Node. Não há subprocessos por request. O supervisor coleta serialmente a cada segundo, sem sobreposição, e verifica RAM a cada **250 ms**. Fontes com mais de 4 s são recusadas. Instalação do observador, coletas detalhadas antes/depois, timestamps e custo de cada amostra são registrados separadamente.

O tamanho exato do diretório PostgreSQL é medido antes/depois, fora da janela. Durante a rodada usa-se a base exata acrescida de deltas positivos do banco/WAL e temporários observados, com margens da 4.3. Não é medição contínua de todos os arquivos do Docker. CPU, sessões e consultas curtas podem escapar da amostragem; zero observações não significa ausência de consumo/queries. Cinco operações não sustentam percentis de cauda ou capacidade. Resultados efetivamente executados: `LOAD_BASELINE_REPORT.md`.

## Decisão e alcance

Ferramenta: **k6 1.3.0 local**, sem cloud, navegador ou plataforma de observabilidade. Oferece VUs, executores com iterações finitas, cookies/headers, checks, percentis e thresholds sem dependências npm. Versão fixada para reprodução, não por ser a mais recente. Artillery seria viável, mas acrescentaria dependências Node; Playwright permanece E2E funcional, não gerador de carga desta baseline.

Referências oficiais: [instalação](https://grafana.com/docs/k6/latest/set-up/install-k6/), [release fixada](https://github.com/grafana/k6/releases/tag/v1.3.0), [iterações compartilhadas](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/shared-iterations/), [thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/). `shared-iterations` limita o total, mas não divide trabalho igualmente entre VUs. Não é um teste de taxa de chegada fixa.

Na 5.1 foram preparados configuração e contratos, sem execução. A atualização parcial da 5.2 acrescenta leituras medidas, supervisão e testes das fixtures. Scripts de escrita aceitam somente HTTP simulado ou o ambiente dedicado de teste; o destino de escala permanece recusado. Não há captura pública, gateway externo ou sucesso financeiro fictício.

## Ambiente isolado

- API Express compilada em **processo próprio, porta 8051**, somente `marketplace_scale` em `127.0.0.1:5435`. Não alterar `.env` ou reiniciar a API de desenvolvimento com outra URL. Next, BFF, TLS, browser e gateway real ficam fora da medição.
- `load:api` recebe confirmação explícita, valida a mesma identidade SQL/container/volume da 4.3, exige baseline `completed/small` e contagens intactas, confere orçamento e inicia `dist/server.js`, `NODE_ENV=production`, pool Prisma de **5** conexões. Segredo JWT aleatório local por processo; nenhuma credencial de produção ou leitura automática de `.env`.
- Destino do script fixo `http://127.0.0.1:8051`, sem redirecionamentos. Runner nativo no Windows evita diferenças de rede/NAT do Docker. A imagem `grafana/k6:1.3.0` é alternativa de distribuição/inspeção; executar carga Docker exigiria uma decisão explícita sobre `host.docker.internal`, hoje recusado. Não usar host/URL remoto.
- O entrypoint exclusivo de carga importa a aplicação compilada e escuta somente `127.0.0.1:8051`. Não houve alteração do binding do código de produção.
- Banco/volume/controle da 4.3 permanecem: `marketplace-scale-postgres`, `marketplace_scale_data`, PGDATA `/var/lib/postgresql/data/pgdata`. Alvo preventivo **5 GiB**, teto **10 GiB**, espaço livre Windows e margens não são substituídos por espaço livre da VM. Não executar load/purge nem medium/large.

Inventário histórico da 5.1 (23/10/2026, sem banco): Node **24.21.0**, npm **11.19.0**, Windows x64, AMD Ryzen 5 5600, **12 processadores lógicos**, 17.083.686.912 bytes de RAM total. A amostra de RAM livre foi 1.903.755.264 bytes, abaixo do mínimo de 2 GiB: **adiar execução se persistir**. PostgreSQL **16.15** e Engine Docker **29.7.2** foram observados na 4.3, não revalidados nesta etapa. Naquela data k6 ainda não estava instalado. A 5.2 validou versão/checksum e registra versões reais, commit/diff, limites CPU/RAM da VM e do container e recursos antes de cada rodada; consultar o relatório atual, sem reutilizar a amostra histórica de RAM como estado presente.

API, PostgreSQL e gerador de carga competirão pela mesma CPU, memória e disco. Os números não poderão ser extrapolados para produção ou tratados como capacidade isolada da API.

## Instalação e comandos

Executar na pasta `nodejs-backend`. Dependências Node pelo `npm.cmd ci` e lockfile existente; isso não semeia bancos. Instalação opcional do binário Windows amd64 **v1.3.0**, somente quando preparar a 5.2 (não executada nesta etapa):

```powershell
New-Item -ItemType Directory -Force load/.local
Invoke-WebRequest 'https://github.com/grafana/k6/releases/download/v1.3.0/k6-v1.3.0-windows-amd64.zip' -OutFile load/.local/k6.zip
$archiveHash = (Get-FileHash load/.local/k6.zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($archiveHash -ne '06a15d69869efb9261e6c132af64078731ad7d048095eaca05198daacb17686d') {
  throw 'Checksum k6 divergente; não executar'
}
Expand-Archive load/.local/k6.zip -DestinationPath load/.local/tools
$env:PATH = "$(Resolve-Path load/.local/tools/k6-v1.3.0-windows-amd64);$env:PATH"
k6 version
```

Checksum publicado na release oficial. Não usar `latest` ou atualizar silenciosamente; manter a ferramenta fora do Git. Não instalar browser/Chromium para estes testes de protocolo.

**Agora — sem banco ou HTTP:**

```powershell
npm.cmd run test:load-plan
npm.cmd run load:plan
```

`load:plan` mostra configuração/recursos locais; não conecta banco nem inicia carga. `test:load-baseline` valida também os dois limiares de memória e o bloqueio dos estágios não autorizados.

**Preparação explícita para os smokes de leitura da 5.2:**

```powershell
npm.cmd run build
# Terminal exclusivo: valida destino/baseline/armazenamento e inicia API compilada
npm.cmd run load:api -- --confirm-scale --read-smoke

# Outro terminal, após GET / responder: descoberta SQL somente leitura + dois logins
npm.cmd run load:sessions -- --confirm-scale --read-smoke
```

`load:sessions` não cria carrinhos nem modifica estoque. Descobre cinco produtos mais comprados por agregação de OrderItem, ordenação `count DESC,id ASC`; descobre sellers de maior/menor volume por contagem de SellerOrder, sem IDs copiados. Valida a identidade retornada por `/users/me` contra a descoberta SQL. Logins são feitos **antes da medição**; o contrato atual só consulta credenciais, não grava lastLogin.

Cookies são obtidos de `Set-Cookie`, nunca do body; k6 envia somente `Cookie: token=...` explicitamente por seller. Em produção o cookie é Secure; este harness de protocolo encaminha o header explicitamente por HTTP loopback local, não é uma validação de segurança de browser/TLS. `.local/read-manifest.json` contém cookies e não deve ser versionado/compartilhado. Expira conservadoramente em 45 minutos (JWT 1 h), precisa ser recriado após reiniciar a API. O modo POSIX 0600 não substitui ACLs no Windows: usar perfil de usuário privado. Não imprimir tokens, fazer login por iteração ou salvar credenciais reais.

**Leituras autorizadas — escolher apenas uma rodada por vez:**

```powershell
# Escolher UMA chamada, conferir resultado/recursos e decidir manualmente a próxima.
npm.cmd run load:read -- catalog all smoke
# Variantes: all | search | filtered1 | filtered2 | unavailable
# Exemplo alternativo: npm.cmd run load:read -- product popular smoke
# Exemplo alternativo: npm.cmd run load:read -- dashboard high smoke /dashboard/seller/summary
# Para menor volume, escolher low no lugar de high; um endpoint por rodada.
# Nesta autorização, somente smoke. Low/gradual continuam bloqueados.
```

O comando passa pelo novo runner supervisionado: valida memória antes de conectar, recusa rodada concorrente, verifica k6/manifesto/identidade do dataset e prepara um oráculo SQL read-only. Faz um GET de validação/aquecimento por alvo (até cinco no produto), fora da janela medida; aborta se houver divergência. Cada execução futura recebe um identificador e resultados agregados limitados em `load/results/`, sem bodies/cookies/export HTTP linha a linha. Não executar o arquivo k6 diretamente: o modo não supervisionado foi desabilitado. Escritas continuam recusadas antes de HTTP.

**Atualização parcial da 5.2 (24/10/2026):** as rodadas agora isolam um endpoint e seller por vez. Assim o dashboard mede **um GET por operação**, não os oito GETs misturados do esboço 5.1: até 5/40/100 requests **por endpoint/seller/estágio**. A configuração original conserva o teto teórico da jornada completa; o orçamento efetivo reduzido é registrado no relatório do runner. Somente após revisar a rodada anterior escolher explicitamente o próximo endpoint ou estágio. Relatório de bloqueio atual: `LOAD_BASELINE_REPORT.md`.

O supervisor agrega máximos/mínimos amostrados, até 64 timestamps e no máximo 20 fingerprints de consultas ativas acima de 1 s, sem texto SQL. Cada consulta periódica tem statement timeout de 2 s e transação de até 3 s. Falha indispensável interrompe o filho k6. CPU API/PostgreSQL é percentual de núcleo; CPU host é média das CPUs lógicas. Recursos da VM são configuração, não consumo VM-wide contínuo. As fontes têm resoluções diferentes: IPC 1 s, stream Docker e SQL periódico; não atribuir seu consumo individualmente a cada request.

Hashes SHA-256 das 22 tabelas, em páginas keyset de até 500, são comparados antes/depois de cada leitura medida, fora da janela k6. Os smokes aprovados validaram oráculos, hashing e coleta no PostgreSQL real. O relatório guarda versão/commit/diff local, identidade do PID da API, limites, contagens/metrics k6, preparo/aquecimento/verificação e custo do observador. `windowWithMonitorMs` inclui a finalização do supervisor; duração/rates do k6 delimitam sua própria janela.

`npm.cmd run test:load-baseline` testa os guardas/interrupção e `k6 inspect` sem HTTP, usando arquivos fictícios em diretório temporário próprio. O teste de runtime é explicitamente skipped se k6 não estiver instalado. Neste host o sandbox restringiu um canal TLS de diagnóstico herdado; com permissão fora do sandbox o inspect passou. Não alterar antivírus ou configurações globais para contornar esse erro.

Status/diagnóstico: `npm.cmd run load:plan` lê só configuração/recursos do host; `npm.cmd run scale:status` e `npm.cmd run scale:verify` são somente leitura. `.local/read-run.lock` impede concorrência e identifica encerramento abrupto; confirmar PID/ausência de runner antes de remover explicitamente um lock órfão. Não apagar locks automaticamente nem reutilizar manifesto expirado. O advisory lock da 4.3 é mantido durante a rodada para impedir purge/geração concorrentes. A recuperação de fixtures descrita abaixo só aceita o banco dedicado de teste, nunca o small.

Encerramento: Ctrl+C no k6 e no terminal da API; conferir que o processo filho Node/porta 8051 foi encerrado. O runner encaminha SIGINT e não gerencia serviços de desenvolvimento; não usar `taskkill` global. Não parar/remover containers ou volumes de outros ambientes. O PostgreSQL de escala pode ficar ligado para inspeção. Interrupção de escrita exigirá reconciliação somente leitura antes de qualquer recuperação.

## Matriz de cenários e contratos

As variantes rodam separadamente, não misturadas em um único gráfico. Preparação e verificações finais ficam fora do tempo medido, mas seus custos são relatados à parte.

| Cenário                | Entrada/preparação                                                                                       | Operação medida e resultado esperado                                                                                                                                                                                      | Efeito/limite                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo               | Dataset small intacto; seller/category descobertos                                                       | `GET /products` alterna listagem e combinação `search=Scale&sellerId=...&category=...&inStock=true&page=1/2&limit=5`, além de indisponíveis; 200, `{data,pagination}`. Filtros no banco, não filtrar a página em memória. | Sem escrita; 1 GET/operação. Totais/páginas e predicados devem ser comparados ao oráculo SQL antes/depois na 5.2.                                                                                                                 |
| Produto                | Cinco IDs líderes por linhas históricas; janela fixa                                                     | `GET /products/:id`, round-robin sobre cinco produtos populares, 200 com centavos/currency/estoque.                                                                                                                       | Hot spot de leitura; 1 GET/operação, não exige dataset maior.                                                                                                                                                                     |
| Carrinho               | Customers exclusivos de experimento, produto exclusivo por customer com onHand=4, reserved=0, cart vazio | `POST /cart/items {productId,quantity:1}` →201; `PUT /cart/items/:productId {quantity:2}` →200, conferir qty/total/estoque.                                                                                               | Até 2 requests/operação, cada customer usado uma vez; 1 Cart/CartItem por participante. Não usar `GET /cart` de customers-base: ele pode criar carrinho ACTIVE.                                                                   |
| Checkout compartilhado | Customers/carts/endereço próprios, todos com 1 unidade do MESMO produto experimental; estoque total 2    | `POST /checkout {addressId}`, chave única por compra, 201; após duas reservas, 409 **Cart stock is insufficient**.                                                                                                        | Máximo 2 Orders; losers sem Order/reserva; estoque nunca negativo. Preparar todos os carrinhos antes da disputa.                                                                                                                  |
| Checkout distribuído   | Um produto experimental por participante, estoque 1 cada                                                 | Mesmo POST com customer/endereço/chave distintos; todos 201.                                                                                                                                                              | Até 20 Orders/rodada. Comparar com estoque compartilhado, sem alterar produto-base.                                                                                                                                               |
| Idempotência           | Um customer/cart/address experimental e uma chave fixa por grupo/rodada                                  | POST concorrente MESMA chave/body: uma criação 201, replays 200 com `Idempotency-Replayed: true`, ou 409 **Idempotency key is processing**.                                                                               | Exatamente 1 Order e uma chave concluída por grupo. Comparar TODOS os IDs, não só status. 409 divergente/estoque/vazio não é replay válido.                                                                                       |
| Pagamento              | Order experimental PENDING_PAYMENT com total/ownership preparados, sem attempt ativo; sessão do customer | `POST /orders/:id/payment-attempts {method:"PIX"}` →201, valor integral/moeda da Order, CREATED e referência DEV_SIMULATOR; duplicatas 409 **Order already has an active or captured payment attempt**.                   | Uma tentativa ativa por Order. Variantes: participantes distintos ou concorrência na mesma Order. Nenhum amount/currency/status no payload; sem captura pública ou promessa de Order CONFIRMED.                                   |
| Dashboard              | Sessões separadas dos sellers maior/menor volume e período fixo jan–nov/2026                             | Oito GETs `/dashboard/seller/{summary,orders,orders/by-status,sales/timeseries,sales/by-category,products/top,customers/new,ratings}`, 200; orders com page/limit/status, série diária padrão.                            | Sem escrita; **8 GETs/operação**. Comparar perfis em rodadas separadas na 5.2; runner-base alterna identidades. Receita usa DELIVERED/completedAt; contagem/lista usa createdAt; valores em centavos, reputação só seller direto. |

O runner supervisionado compara os campos relevantes/ordem de arrays ao oráculo SQL antes da medição e a cada GET, além de status; ainda depende da validação PostgreSQL real pendente. Campo inexistente ou enum incorreto é falha, não sucesso vazio. O catálogo tem também `/products/search?q=...` e rotas por seller/category; usa-se a listagem geral para manter uma comparação controlada com todos os filtros. Na matriz acima o fan-out/alternância do dashboard descreve o esboço 5.1; a execução 5.2 separa todos os endpoints/sellers, conforme atualização operacional.

## Preservação e repetibilidade das escritas (regras do grafo experimental)

Não usar Orders históricas, users-base ou estoque reservado como fixtures descartáveis. Usar um **namespace estável de experimento** com manifesto/registro próprio em `scale_ops` (fora de tabelas de negócio, sem migration Prisma): IDs gerados/registrados, usuários `load.<round>.*@local.invalid`, seller próprio, produtos/referências `LOAD-*`, endereços e carts próprios. Descoberta da base só serve para leituras; não converter um usuário-base em participante de escrita.

Por rodada/cenário: **até 20 customers, 1 seller e 21 produtos**, um endereço por customer, até 20 carts/itens, 20 Orders/SellerOrders/OrderItems/reservas/movimentos/chaves e 20 attempts. Idempotência compartilhada usa 1 customer/Order; checkout compartilhado usa um produto. Stock initialization exige movimento correspondente. Quantidades/rodadas são finitas; jamais acrescentar um novo conjunto a cada retry sem resolver o anterior.

Preparação deve registrar/validar: identidade exclusiva, baseline/counters/hash dos registros-base, namespace sem colisão, IDs próprios e FKs sem cruzamento com base ou outro experimento; mesmos limites de armazenamento da 4.3. Não usar purge do gerador. A checagem estrita do launcher/sessions pressupõe base intacta: preparar as sessões de leitura antes de qualquer escrita, e executar leituras-base antes das rodadas de escrita.

**Recuperação implementada e testada no banco dedicado; ainda não liberada para escala:** parar API/runner, reconciliar somente por SELECT todos os IDs/efeitos inclusive resposta perdida, adquirir exclusão mútua e executar limpeza transacional apenas do grafo experimental enumerado, na ordem das FKs. Remover conjuntamente reservas, movimentos e inventários/produtos experimentais, históricos, attempts, chaves, endereço snapshot, itens/Orders, carts, endereços, perfis/users próprios. Isso é desmontagem isolada de fixture, **não liberação comercial de reserva** nem cancelamento de pedido real. Se houver relação cruzada, pagamento externo, dados não registrados ou estado ambíguo, abortar e exigir revisão. Não executar DELETE amplo, TRUNCATE/CASCADE global ou editar saldos-base para "corrigir" resultado.

Após recuperação: provar ausência do namespace, contagens/hash-base inalterados e invariantes 4.3 preservadas; só então autorizar rodada seguinte com manifesto limpo. Não implementar retry automático ou cleanup em `teardown` que esconda falhas. Se não for possível provar a desmontagem segura, **não executar cenários de escrita** até decisão do responsável.

## Fixtures implementadas — exclusivamente teste dedicado

`docker-compose.load-test.yml` define `marketplace-load-test-postgres`, usuário/banco `marketplace_load_test`, loopback **5436**, volume `marketplace_load_fixture_test_data`. A proteção exige URL exata, usuário/senha fictícia de teste, porta, label do container, volume e marcador SQL; localhost sozinho não autoriza. A baseline existente é aplicada por `migrate deploy`, sem alterar schema/migrations. Nunca usar desenvolvimento, E2E ou escala como banco descartável.

```powershell
# Requer >=2 GiB disponíveis e espaço Windows; inicia só o container de testes.
npm.cmd run load:fixture-test:prepare
npm.cmd run test:load-fixtures
npm.cmd run test:load-writes
npm.cmd run test:load-resources

# Operação manual do banco de TESTE; não é preparação do dataset small.
npm.cmd run load:fixture -- status
npm.cmd run load:fixture -- prepare cart 2 marketplace_load_test@127.0.0.1:5436
npm.cmd run load:fixture -- reconcile
# Somente após parar API/runner e conferir o grafo:
npm.cmd run load:fixture -- recover marketplace_load_test@127.0.0.1:5436 API_AND_RUNNER_STOPPED
docker stop marketplace-load-test-postgres
```

O manifesto persistente `scale_ops.load_experiments` registra namespace `load-<uuid>`, raízes, chaves estáveis e assinatura/contagem anterior por tabela. Estados: EMPTY → PREPARING → READY → RUNNING; erro deixa UNKNOWN e recuperação explícita deixa RECOVERED. PREPARING/RUNNING órfãos continuam bloqueando outra preparação após reinício. O advisory lock comum recusa preparação/rodada/recuperação simultâneas. Uma recuperação de estado órfão exige exclusão adquirida, confirmação de processos parados e ausência de clientes de API no banco.

A preparação admite até 20 customers, um seller e no máximo 21 produtos; o planejador atual usa no máximo 20. Grafo limitado a 512 registros, consultas limitadas e manifesto/efeitos a 128 KiB. Produtos, usuários, inventários, movimentos, endereços, carrinhos e pedidos de pagamento pertencem apenas ao namespace. Não há ligação com usuários ou estoque históricos. Uma resposta perdida é reconciliada consultando FKs das raízes, sem inventar outro ID/chave. Pagamento CAPTURED/externo, refunds/deliveries/reviews inesperados ou FK cruzada impedem desmontagem.

A recuperação verifica a assinatura histórica antes de qualquer delete, remove somente IDs enumerados na ordem das FKs e confirma a assinatura novamente na mesma transação Serializable. Reservas, movimentos e inventários experimentais são removidos juntos; isso não simula liberação comercial. Falha na limpeza reverte todos os deletes e mantém o manifesto. Não há cleanup em falha/teardown, TRUNCATE, CASCADE ou purge da 4.3. A suíte tem um usuário sentinela próprio que permanece no banco de teste para provar a preservação histórica.

`write-scenarios.js` implementa os cinco contratos com transporte/inspeção injetados, barreira de despacho e orçamento finito (até 20 operações/4 participantes simultâneos). Somente simulação ou API de teste fixa `127.0.0.1:8052` são aceitas; não há launcher de escrita para escala. Os testes HTTP simulados validam requests, erros exatos e pós-condições, inclusive resposta perdida sem retry. Simulação de despacho concorrente não comprova disputa real por locks PostgreSQL. API de teste 8052 não é iniciada automaticamente e nenhum novo endpoint foi criado.

**Liberação futura ainda necessária:** adaptar explicitamente o controlador para namespace operacional no ambiente de escala, validar margens de armazenamento e supervisão na futura janela de escrita, conectar transporte autenticado real e obter autorização do responsável. Os testes de recuperação dedicados não autorizam escrita no small nem substituem suas invariantes. Não publicar os scripts preparados como resultados medidos.

## Progressão, métricas e interrupção

| Etapa manual | VUs leitura | Operações leitura / duração máxima | VUs escrita | Operações escrita / duração máxima |
| ------------ | ----------: | ---------------------------------- | ----------: | ---------------------------------- |
| Smoke        |           1 | 5 / 30 s                           |           1 | 2 / 30 s                           |
| Baixa        |           2 | 40 / 90 s                          |           2 | 10 / 90 s                          |
| Gradual      |           5 | 100 / 180 s                        |           4 | 20 / 180 s                         |

Os números são tetos, não duração fixa nem taxa de chegada. Pausa de **1 s/operação**, timeout **10 s/request**, redirects desativados e **zero retry automático**. Requests máximos = operações × requests/operação: leitura simples 5/40/100; dashboard 40/320/800; carrinho 4/20/40. Preparação/logins/oráculos contam separadamente no relatório. Operações adicionais de diagnóstico fora da medição são limitadas e registradas.

Smoke serial não demonstra concorrência. Na 5.2 usar baixa/gradual para disputas, barreira de início dos participantes e dados iguais/controlados; não confundir VUs ativos com prova de simultaneidade no banco. Para idempotência PROCESSING, após resultado incerto permitir no máximo **um replay diagnóstico explícito** com mesma chave/endereço fora da janela medida; persistindo incerteza, parar, sem nova chave/Order.

Medir requests/s e operações/s separadamente, duração da janela, VUs, p50/mediana, p95, p99, `http_req_failed`, timeouts e transporte, `unexpected_results`, checks e `business_results` por resultado. Em escritas adicionar contadores de criação, conflito esperado, replay e invariantes persistidas. Não esconder todo 409 em `expectedStatuses`: o corpo exato e a pós-condição de negócio são necessários. 400/401/403/404/5xx, conflito não previsto, JSON inválido e timeout são inesperados. Não gravar JWT ou IDs por request em logs de alto volume.

Hipóteses locais iniciais: p95 <1.000 ms, p99 <2.000 ms, inesperados <1%; não são SLAs. Read runner interrompe no primeiro resultado inesperado, além dos thresholds; amostras pequenas não sustentam inferência de percentis de cauda. Os conflitos previstos devem ter taxa/latência próprias, nunca inflar throughput de sucesso.

Na supervisão periódica de **1 s** (RAM a 250 ms), interromper se CPU host >85% por 15 s, memória abaixo do piso aplicável (somente smoke de leitura: 1 GiB; demais: 2 GiB), conexões >20, espera de lock >10 s, orçamento 4.3/margem Windows comprometidos ou falha técnica/invariante inesperada. O início exige 1,25 GiB no smoke de leitura ou 2 GiB nos demais. Tetos de tempo/operações prevalecem. Coleta validada em smokes reais não demonstra reação a todo pico de curta duração. Não desabilitar durabilidade, mexer em configuração global ou adicionar observabilidade completa.

## Ordem proposta para 5.2 e pendências concretas

1. Revisar espaço/memória e registrar versões/recursos reais, confirmar small intacto, instalar/verificar k6 fixado e validar o script no runtime k6.
2. Build isolada, API exclusiva, disponibilidade HTTP e sessões fora da medição. Preparar observação/abort de recursos e oráculos de leitura; delimitar aquecimento separado (até uma operação por cenário, registrado).
3. Smoke de catálogo/produto/dashboard **um por vez**; baixa e gradual somente após autorização posterior explícita e disponibilidade >=2 GiB. Separar sellers de maior/menor volume e variantes de filtros/série para comparação.
4. Manifesto, preparação e recuperação foram implementados/testados somente no banco dedicado. Ainda bloquear execução real de escrita e exigir novo aceite, adaptação explícita do destino e supervisão antes dessa janela. Não acessar estoque/pedidos-base para obter resultado positivo.
5. Futuramente, após novo aceite: smoke/baixa/gradual de cart, checkout compartilhado/distribuído, idempotência e pagamento. Conferir invariantes e recuperar explicitamente entre cenários; parar em resultado desconhecido. Não executar captura de pagamento.
6. Relatar tamanho do dataset, concorrência, erros técnicos versus resultados de negócio, limites/picos de recursos e condições de máquina compartilhada; guardar apenas agregados em `load/results/` ignorado. Nenhuma conclusão de capacidade ou baseline foi produzida na 5.1.

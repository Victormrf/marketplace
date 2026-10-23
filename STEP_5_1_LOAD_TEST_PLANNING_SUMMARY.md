# Etapa 5.1 — Planejamento e preparação dos testes de carga

Em 23/10/2026, foi definido **k6 1.3.0 nativo Windows** para a futura baseline diretamente na API Express compilada, em processo exclusivo na porta **8051**, apontando somente para `marketplace_scale:5435`. Sem Next/BFF, nodemon, cloud ou novas dependências npm. Comandos, checksum da instalação e matriz operacional estão centralizados em `nodejs-backend/docs/LOAD_TEST_PLAN.md`.

Configuração versionada `load/plan.json`: catálogo, produto popular, carrinho, checkout compartilhado/distribuído, idempotência, pagamento integral e dashboard. Leituras-base possuem runner GET com status/estrutura, tags normalizadas, cookies explícitos, percentis e abort em resultado inesperado. Descoberta futura usa agregações SQL, não IDs copiados; login e `/users/me` ficam fora da janela medida. Cookies/manifests/resultados ficam em diretórios ignorados pelo Git.

Progressão manual de leitura: **1/2/5 VUs**, **5/40/100 operações**, teto **30/90/180 s**. Dashboard executa 8 GETs por operação, portanto até 40/320/800 requests. Escritas planejadas: 1/2/4 VUs, 2/10/20 operações, mesmos tetos temporais; permanecem **bloqueadas no runner** até preparação/recuperação de fixtures próprias na 5.2. Timeout 10 s, pausa 1 s/operação, sem retry automático. Thresholds p95 <1.000 ms e p99 <2.000 ms são hipóteses locais, não SLA.

Preservação: não tocar em users, Orders ou estoques históricos. Proposto namespace experimental, no máximo 20 customers, 1 seller e 21 produtos por rodada, manifesto persistente fora das tabelas de negócio e recuperação transacional somente do grafo próprio após reconciliação/checagem de FKs. Não usar purge do gerador nem cleanup automático em falha. 409 só é previsto por cenário e mensagem exata; ainda exige pós-condição de negócio, não apenas contagem HTTP. Pagamento para em CREATED/ref externo DEV_SIMULATOR: não há captura pública.

Validação observada, **sem banco ou HTTP real**:

- `npm.cmd run test:load-plan`: **8/8**, incluindo limites, bloqueio de escrita, classificação de conflitos reais, destino/sessões/expiração, baseline small, contratos e sintaxe; operações GET exercitadas em ambiente VM com HTTP falso, não como carga real.
- `npm.cmd run load:plan`: plano e inventário do host, **0 requests executados**.
- `npm.cmd run test:scale-profiles`: **5/5**.
- `npm.cmd run test:scale-distributions`: **7/7**.
- `npm.cmd run test:scale-loader`: **8/8**.

Máquina observada: Node 24.21.0, npm 11.19.0, Windows x64, Ryzen 5 5600, 12 CPUs lógicas e aproximadamente 15,91 GiB RAM. Amostras de memória livre inferiores a 2 GiB: adiar teste se persistir. Não foram instalados/executados k6, iniciada API, preparados logins, consultados bancos ou executadas operações de negócio, geração ou purge. Schema, migrations, regras, dataset small e ambientes de desenvolvimento/E2E/produção não foram alterados.

5.1 concluída como **planejamento estaticamente validado**, não como baseline de desempenho. Para 5.2: instalar/verificar runtime k6, registrar recursos reais da VM/container, observar recursos durante execução, preparar oráculos e validar leituras; implementar/testar fixtures e recuperação antes de liberar escritas. O monitoramento contínuo ainda não existe no runner-base; limites de CPU/RAM/conexões/storage estão definidos, não comprovados em carga. Pendências transversais existentes preservadas.

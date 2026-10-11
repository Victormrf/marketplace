# Execução E2E local

## Pré-requisitos e instalação

- Windows com Docker Desktop ativo e acessível pelo Docker Compose.
- Node.js e npm compatíveis com os lockfiles. A baseline registrada foi executada
  com Node `24.21.0` e npm `11.19.0`.
- Instale dependências reproduzíveis com `npm ci` em `nodejs-backend` e em
  `nextjs-frontend`; não use `npm install` para preparar a suíte.
- No frontend, instale a versão Chromium correspondente ao Playwright travado no
  lockfile: `npx playwright install chromium`.

## Comandos

Execute a partir de `nextjs-frontend`:

```sh
npm run e2e:prepare
npm run test:e2e
npm run test:e2e -- --grep "checkout: lost real response"
npm run e2e:report
npm run test:e2e:safety
```

`test:e2e` também prepara o ambiente, portanto `e2e:prepare` é opcional quando
se deseja executar os testes diretamente. O runner valida a URL de destino
exata antes de migrations ou acesso de escrita, inicia o serviço `postgres-e2e`,
aguarda o healthcheck, aplica apenas as migrations existentes e compila o
backend. O Playwright inicia backend e Next nas portas exclusivas `8100` e
`3100`, espera os endpoints de disponibilidade e encerra os dois processos ao
fim. Não inicie os servidores manualmente; processos já existentes não são
reutilizados.

O único banco autorizado é `127.0.0.1:5434/marketplace_e2e`, com usuário de
teste dedicado. A configuração valida protocolo, host, porta, database, usuário,
senha e ausência de parâmetros extras. Antes de cada limpeza, a conexão confirma
`current_database()` e `current_user`. `marketplace_dev` e qualquer destino
remoto são recusados; nenhum comando de limpeza remove containers ou volumes.

## Fixtures, isolamento e relatórios

Os testes rodam serialmente com um worker e sem retries. Cada cenário limpa e
cria seus próprios dados determinísticos: users CUSTOMER e SELLER (incluindo um
segundo seller), perfis, cinco produtos com inventários, dois endereços e um
SellerOrder preparado. Os próprios testes concluem os demais estados necessários.
Não há dependência do seed de desenvolvimento nem de storageState persistido.
O teardown apaga somente registros do banco E2E e verifica que as tabelas de
negócio ficaram vazias; a tabela de migrations é mantida.

O relatório JSON fica em `test-results/results.json`; `npm run e2e:report` abre o
HTML em `playwright-report`. Screenshots e traces são preservados somente em
falhas. As duas pastas são ignoradas pelo Git. Traces podem conter cookies de
sessões descartáveis; revise-os antes de compartilhar.

## Encerramento e recuperação

Em uma execução normal, Playwright encerra os processos Next/backend. O container
Postgres E2E permanece disponível para reutilizar o ambiente. Para pará-lo sem
remover container ou volume, execute no frontend:

```sh
docker compose -f ../docker-compose.e2e.yml stop postgres-e2e
```

Após interrupção forçada, primeiro confira os listeners das portas `3100` e
`8100` e identifique a linha de comando do processo antes de encerrá-lo. Exemplo
PowerShell (substitua o PID somente depois de confirmar que pertence ao Next ou
backend E2E):

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3100,8100
Get-CimInstance Win32_Process -Filter "ProcessId = 1234" |
  Select-Object ProcessId, CommandLine
Stop-Process -Id 1234
```

Se a execução foi interrompida, pare apenas o serviço dedicado com o comando
acima e execute novamente `npm run test:e2e`. O runner reinicia o banco, aplica
migrations pendentes e cada fixture começa limpando/verificando o destino
autorizado. Não use `docker compose down`, `--remove-orphans` ou comandos de
remoção: o compose de desenvolvimento pode estar ativo.

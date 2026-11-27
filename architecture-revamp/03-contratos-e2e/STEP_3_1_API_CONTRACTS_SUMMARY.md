# Etapa 3.1 — Contratos de API

## Resultado

- Criada uma especificação OpenAPI 3.0.3 em `nodejs-backend/docs/openapi.yaml`, baseada nas rotas, controllers, validações, services e DTOs atuais do backend.
- O contrato descreve 53 caminhos e 71 operações, incluindo autenticação/roles, ownership, inputs, respostas/status, erros, filtros e paginação.
- Foram documentadas as regras de centavos e currency, os três níveis de estoque, checkout idempotente, cobranças integrais, refunds e máquinas públicas de estado.
- O viewer usa Swagger UI 5.33.1, somente leitura e sem “Try it out” nem validação remota. A página e a especificação são servidas localmente em `/docs` e `/docs/openapi.yaml` somente quando `NODE_ENV !== "production"`; os assets da interface vêm do CDN versionado e exigem conectividade externa no navegador.
- `npm run validate:openapi` usa apenas APIs nativas do Node para validar a sintaxe JSON (subconjunto válido de YAML 1.2), referências locais, parâmetros de rota, operationIds e a contagem declarada.

## Limites e decisões

- O documento especifica exclusivamente as rotas Express do backend. A ponte Next `/api` e suas regras de cookie/origem são uma integração separada, não duplicada aqui.
- A escolha do formato JSON compatível com YAML 1.2 mantém o comando de validação sem dependências externas; ferramentas OpenAPI dedicadas podem ser adicionadas posteriormente se o projeto desejar linting semântico mais amplo.
- Endpoints internos de provider/jobs não são expostos como operações HTTP.

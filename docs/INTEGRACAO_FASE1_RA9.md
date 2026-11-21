# CampusFlow — Integração Frontend ↔ Backend — fase 1 (RA protegido)

## Pré-requisitos e escopo

- Base: frontend v2 enviado pelo grupo; backend Express/MariaDB já desenvolvido; atualização de RA com nove dígitos **deve estar aplicada e validada no banco**.
- **Não foi possível testar contra o XAMPP do computador do grupo.** O pacote foi verificado estaticamente. Não presumir que uma migração anterior tenha sido concluída; se o backend ainda não a recebeu, seguir o roteiro de backup/migração anterior antes de iniciar a fase 1.
- O código desta fase não sobrescreve o backend; só adiciona o diretório `frontend/` e documentação.

## Endpoints reais usados

| Página | Método/rota | Corpo enviado | Resposta utilizada |
|---|---|---|---|
| `index.html` | `POST /api/auth/login` | `{nome_usuario, senha}` | `{token, usuario, expira_em}` |
| `pages/cadastro.html` | `POST /api/auth/cadastro` | `{nome_completo, nome_usuario, email, telefone, ra, senha}` | `201 {mensagem, id}` |
| `pages/salas.html` | `GET /api/auth/me` | Bearer token | `{usuario}` sem RA legível |
| `pages/salas.html` | `GET /api/salas` | Bearer token | `{salas:[{id,nome,predio,capacidade,abre_as,fecha_as,descricao,estado_agora}]}` |

O **RA** deve ser uma `string` de exatamente nove dígitos, para preservar zeros iniciais. Campos `usuario.ra` foram descontinuados: a API com a migração retorna `ra_cadastrado` e não expõe o RA original.

## Contrato de UI

- Login usa **nome de usuário**, não e-mail.
- Cadastro exige RA de nove dígitos; não registra hash no browser.
- Login bem-sucedido redireciona à listagem das cinco salas.
- A listagem é carregada por `fetch`, mostra prédio, capacidade e horário; não reproduz recursos ou dias que não existem no banco.
- Falha da API deixa mensagem de erro; não usa dados fictícios para disfarçar.
- Botão **Reservar sala** fica desabilitado neste pacote. Implementá-lo na próxima fase com `POST /api/reservas` e validação de disponibilidade pelo backend.
- Sessão do protótipo guardada em `sessionStorage`, apenas para navegação na mesma aba. Em produção usar sessão em cookie seguro e proteção CSRF.

## Teste manual de aceitação

1. Com o XAMPP/MySQL e Node em execução, abrir `http://localhost:3001/api/health`; esperar `banco: conectado`.
2. Abrir `frontend/index.html` com Live Server; entrar com um usuário existente. Login incorreto exibe erro e não navega.
3. Confirmar que a barra superior exibe o nome completo do banco e a tela exibe as **cinco salas do banco**.
4. No cadastro: `12345678` deve falhar no browser; `012345678` deve criar conta (se não houver conflito); RA repetido deve retornar **409**.
5. Confirmar no phpMyAdmin que o cadastro contém `LENGTH(ra) = 60` e `LENGTH(ra_indice) = 64`, sem visualizar os valores.
6. Usar **Sair** e confirmar que o catálogo protegido não pode ser reaberto sem login.
7. Com o Node desligado, verificar que o site exibe erro de conexão (não simula dados).

## Checklist para a equipe

- [ ] Migração RA validada (nove dígitos e hashes nas tabelas).
- [ ] Backend retorna `GET /api/auth/me` sem `ra`.
- [ ] CORS configurado para a origem exata do Live Server.
- [ ] Login, cadastro e listagem testados pelo navegador.
- [ ] Branch da integração criada a partir da versão atualizada do backend.
- [ ] Arquivos de frontend revisados com o integrante 1 antes do merge.
- [ ] Sem `.env`, credenciais nem backup no commit.

## Próxima fase

Integrar o formulário de reserva e o histórico da versão 2 do frontend: `GET /api/salas/recomendadas`, `POST /api/reservas`, `GET /api/reservas/minhas`, `POST /api/reservas/:id/cancelar`, com data/hora incluindo fuso, quantidade de pessoas e sem envio de RA na reserva. Depois, QR Code, notificações e estatísticas administrativas.

## Testes unitários do cliente (sem banco)

Execute na raiz do pacote: `node --test testes/cliente-api.test.cjs`. Esses testes verificam apenas o cliente JavaScript e simulam respostas do servidor; **não validam** a conexão real ou o comportamento visual do navegador.

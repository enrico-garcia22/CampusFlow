# CampusFlow — Observações do frontend v2 recebido

Fonte consultada: `CampusFlow_Frontend_v2.zip` (HTML, CSS e JS puros, executáveis no Live Server).

## Diferenças a alinhar antes da integração

| Tema | Frontend v2 | Backend atual |
|---|---|---|
| Salas | 8 salas fictícias (`assets/js/data.js`) com IDs alfanuméricos, como `a101` | 5 salas (`banco/campusflow.sql`) com IDs numéricos 1–5 |
| Dados | `assets/js/app.js` usa `localStorage` para usuários e reservas | REST + MariaDB; reservas não devem ser salvas no navegador |
| Login | `assets/js/login.js` demonstra entrada por e-mail, sem validar senha | `POST /api/auth/login` usa `nome_usuario` e `senha` |
| Reserva | `assets/js/reserva.js` cria registro local e valida horário no navegador | `POST /api/reservas` valida, persiste e rejeita conflitos |
| Datas | Formulário com campos separados data, início e fim | API requer instantes ISO 8601 com deslocamento de fuso, como `2026-12-15T14:00:00-03:00` |
| Campos | Formulário usa nome, RA, e-mail, finalidade, observações | Responsável é recuperado do login; envia `sala_id`, `inicio`, `fim`, `pessoas`, `titulo`/`descricao` |
| Páginas | Dashboard, mapa, salas, reservas, perfil, módulos e login | Endpoint JSON; não serve páginas HTML |

## Sequência recomendada (para integrante 1 + integrante 2)

1. Definir catálogo oficial inicial: conservar cinco salas do banco ou migrar oito salas do frontend. Não misturar IDs por posição.
2. Implementar um cliente REST `assets/js/api.js`, com tratamento de 401, 403, 409, 422 e erros de conexão, no frontend.
3. Conectar login real (JWT ou, em produção, sessão em cookie HttpOnly + HTTPS), sem persistir senha; criar tela de cadastro se necessário.
4. `GET /api/salas` para carregar o catálogo, adaptando `abre_as`/`fecha_as` para o modelo visual `abertura`/`fechamento`.
5. `POST /api/reservas` para gravar dados no banco; depois listar via `GET /api/reservas/minhas`, cancelar via endpoint existente.
6. Usar `GET /api/salas/recomendadas` ao definir data, horários e quantidade de pessoas; a reserva definitiva ainda precisa validar disponibilidade no servidor.
7. Substituir gradualmente cards e métricas simuladas do dashboard por dados da API; não confundir ocupação simulada em `CF_OCC` com presença via QR Code.
8. Ajustar CORS conforme a origem real do Live Server (`http://127.0.0.1:5500` e/ou `http://localhost:5500`).

**Importante:** este documento é uma análise de compatibilidade. O frontend não foi editado nesta entrega e segue funcionando no seu modo de demonstração. O frontend atualmente contém um guia que menciona PHP para integração; o backend em uso é Node.js/Express com MariaDB.

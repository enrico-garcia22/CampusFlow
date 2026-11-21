# CampusFlow — Integração das reservas (fase 2)

## Escopo

Este pacote **não altera o backend, o banco de dados, o `index.html`, a tela de cadastro nem `components.css`**. Preserva a correção recente do botão "Mostrar" e implementa apenas a integração do catálogo, do formulário e do histórico com a API já validada.

Arquivos a substituir:

- `frontend/assets/js/api.js` — expõe `recomendadas`, `criarReserva`, `minhasReservas` e `cancelarReserva`.
- `frontend/assets/js/app.js` — menu autenticado para as três telas.
- `frontend/assets/js/salas.js` — habilita o botão de reserva e mostra confirmação.
- `frontend/pages/salas.html` — adiciona acesso à reserva.

Arquivos novos:

- `frontend/assets/js/reservas-utils.js` — horários e formatação em `America/Sao_Paulo`.
- `frontend/assets/js/reserva.js` — formulário, sugestões e envio.
- `frontend/assets/js/minhas-reservas.js` — histórico, filtros e cancelamento.
- `frontend/pages/reservar-sala.html` — formulário real.
- `frontend/pages/minhas-reservas.html` — histórico real.

## Como aplicar (na raiz do repositório)

1. Faça `git status` e salve previamente alterações não commitadas. Garanta que o frontend da fase 1 esteja presente e que o login funcione.
2. Baixe e descompacte `CampusFlow_Integracao_Fase2.zip` em uma pasta separada, sem extrair diretamente por cima da raiz do projeto.
3. Copie **apenas a pasta `frontend` contida no ZIP** para a pasta `frontend` do repositório, mesclando/substituindo arquivos homônimos. Alternativamente, utilize os comandos do chat. Nunca substitua o `frontend/index.html` ou o `components.css`.
4. O diretório `tests` do pacote é opcional, mas recomendado para execução de testes.
5. Com o XAMPP/MySQL ativo, execute `cd backend; npm.cmd run dev`.
6. Execute o frontend no Live Server, normalmente `http://127.0.0.1:5500/frontend/index.html` se a pasta aberta no VS Code for a raiz, ou `http://127.0.0.1:5500/index.html` se o Live Server servir a pasta `frontend`.
7. Confirme em `backend/.env` que `FRONTEND_ORIGIN` permite a origem exata do seu navegador, por exemplo `http://127.0.0.1:5500,http://localhost:5500`. Reinicie a API se alterar o `.env`.

## Contrato utilizado

| Ação | Método e rota | Dados |
| --- | --- | --- |
| Autenticar | `POST /api/auth/login` | `{nome_usuario, senha}` |
| Perfil | `GET /api/auth/me` | Bearer JWT |
| Catálogo | `GET /api/salas` | Bearer JWT |
| Recomendar | `GET /api/salas/recomendadas` | `inicio`, `fim`, `pessoas` na query |
| Reservar | `POST /api/reservas` | `{sala_id, inicio, fim, pessoas, titulo?, descricao?, nomes_participantes?}` |
| Histórico | `GET /api/reservas/minhas` | Bearer JWT |
| Cancelar | `POST /api/reservas/:id/cancelar` | Bearer JWT |

O RA **não é solicitado no formulário** e **não é enviado novamente** no payload de reserva: é associado à conta no backend como hash. Nunca exponha `ra`, `ra_hash`, `ra_indice`, `senha_hash` ou `RA_PEPPER` ao navegador.

## Testes manuais

1. Login com a conta `aluno_teste` previamente criada.
2. Catálogo: aparecem as cinco salas e o botão **Reservar sala**.
3. Abrir `Sala 101` e confirmar que ela está pré-selecionada no formulário.
4. Selecionar data futura, período dentro do horário de funcionamento e 12 participantes.
5. Usar **Ver salas recomendadas** e verificar a ordenação por capacidade/horário sem conflito.
6. Enviar a reserva; esperar retorno à página das salas com aviso de sucesso.
7. Abrir **Minhas reservas** e conferir o registro real; conferir também no phpMyAdmin.
8. Tentar repetir mesma sala/data/horário; esperar erro HTTP 409 com mensagem de conflito (ou sala indisponível entre as opções recomendadas).
9. Cancelar reserva futura e verificar status `cancelada`, sem apagar o registro.
10. Refazer a recomendação: a sala deve voltar a aparecer se não houver outro conflito.

Use uma data **ainda futura** quando executar os testes. A API rejeita horários passados.

## Comportamento e limites

- A validação definitiva de horário, capacidade, concorrência e disponibilidade ocorre no servidor; a recomendação não bloqueia sala.
- A API registra apenas reservas válidas, e os campos pessoais do responsável vêm da conta autenticada. Exibir nome/e-mail/telefone no formulário é apenas informativo.
- O protótipo assume o fuso do campus `America/Sao_Paulo` (UTC−03:00 no período atual), de acordo com o backend existente. Ao suportar campi com outros fusos, substituir a conversão fixa por uma conversão baseada em timezone.
- Ainda não há confirmação por QR Code nem envio de e-mail; a API responde `integracoes_pendentes`.
- O histórico pode incluir reservas expiradas/canceladas e não deve ser apagado por ação do frontend.
- `sessionStorage` armazena o token JWT apenas durante a sessão da aba. Para produção serão necessários controles de segurança adicionais (HTTPS, revisão de CORS, CSP, política de sessão e tratamento de dados pessoais).

## Testes automatizados

No computador com Node.js instalado, dentro da pasta descompactada do pacote:

```powershell
node --test .\tests\integracao-fase2.test.cjs
```

Os testes simulam respostas HTTP e validam o contrato do cliente, datas e arquivos. Eles **não substituem** testes end-to-end contra o MariaDB do seu computador. Execute também `npm.cmd test` no backend.

## Git

Após testes manuais, na raiz do seu repositório:

```powershell
git status
git add frontend/assets/js/api.js frontend/assets/js/app.js frontend/assets/js/salas.js frontend/assets/js/reservas-utils.js frontend/assets/js/reserva.js frontend/assets/js/minhas-reservas.js frontend/pages/salas.html frontend/pages/reservar-sala.html frontend/pages/minhas-reservas.html
git diff --cached --name-status
git commit -m "feat: integra reservas e historico ao MariaDB"
git push -u origin feature/integracao-reservas
```

Ajuste o nome da branch se você já estiver trabalhando em outra branch de integração. Não inclua `.env`, `node_modules` ou o export SQL do banco.

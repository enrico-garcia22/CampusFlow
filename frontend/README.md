# CampusFlow — Frontend conectado (fase 1)

Partimos do visual e CSS de `CampusFlow_Frontend_v2.zip`, sem frameworks ou compilação. Nesta fase **somente login, cadastro e catálogo de salas** utilizam a API real. Os demais módulos e a reserva ainda não fazem parte deste pacote, por decisão de escopo; o botão de reserva está desativado de propósito para não levar a uma simulação enganosa.

## Execução

1. Garanta que o backend **já tenha sido migrado** para RA de nove dígitos e que o MariaDB do XAMPP esteja executando.
2. Em `backend/.env`, adicione (ou ajuste) a linha: `FRONTEND_ORIGIN=http://127.0.0.1:5500,http://localhost:5500`. Não substitua as demais chaves. Reinicie `npm.cmd run dev`.
3. Abra a pasta `frontend/` no VS Code, clique em `index.html` e escolha **Open with Live Server**. Acesse `http://127.0.0.1:5500` ou `http://localhost:5500` conforme o servidor.
4. Use `aluno_teste` ou `admin_teste` para login (as senhas não mudam com a migração). Para novo cadastro, digite um **RA de nove caracteres numéricos**, como `012345678` (exemplo exclusivamente fictício).
5. O login deverá abrir `pages/salas.html` com **cinco salas vindas do MariaDB**, não as oito fictícias do frontend anterior.

## Arquivos atualizados

- `assets/js/api.js`: único ponto de configuração da URL da API, `fetch`, tratamento de erros e sessão.
- `assets/js/login.js`, `index.html`: login real por nome de usuário e senha.
- `assets/js/cadastro.js`, `pages/cadastro.html`: cadastro real com RA como string de 9 dígitos.
- `assets/js/app.js`: topo com nome autenticado e opção Sair; apenas links disponíveis na fase 1.
- `assets/js/salas.js`, `pages/salas.html`: GET `/api/salas`, sem campos fictícios de tipo/recursos/dias.
- `assets/css/`: estilos originais do frontend v2 preservados.

## Restrições importantes

- O RA original segue pelo corpo da requisição de cadastro e deve usar HTTPS em qualquer ambiente público; o servidor armazena hash, não o RA.
- Nesta prova de conceito o JWT fica em `sessionStorage` (não `localStorage`). Isto **não protege contra XSS**: evitar código de terceiros, revisar sanitização e, antes de uma implantação real, migrar para cookies de sessão `HttpOnly`, `Secure`, com proteção CSRF.
- Não comitar `.env`, backups do banco, RAs reais, senhas ou tokens.
- O frontend não verifica disponibilidade futura: mostra apenas o estado **agora**, retornado pela API. Reservas, recomendação por data, histórico, painel, mapas e QR Code ficam para próximas fases.
- Se sua porta do Live Server não for `5500`, altere **somente** `FRONTEND_ORIGIN` no `.env` e reinicie a API.

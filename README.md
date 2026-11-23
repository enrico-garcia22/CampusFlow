# CampusFlow

**Sistema de gestão e reserva inteligente de espaços acadêmicos**

Projeto acadêmico desenvolvido em grupo na disciplina de **Sistemas Computacionais (UNESP)**. O CampusFlow reúne catálogo de salas, reservas por período, recomendação de espaços, confirmação de presença por QR Code e acompanhamento da utilização de salas universitárias.

> **Estado do projeto:** versão acadêmica integrada e validada localmente. A publicação em hospedagem pública com HTTPS e a validação nesse ambiente ainda são etapas futuras. Os espaços e dados iniciais do banco são **demonstrativos**, não um cadastro oficial de salas da universidade.

## 1. Visão geral

O CampusFlow busca reduzir conflitos de horários e ociosidade de salas. Ao informar a data, o intervalo e a quantidade prevista de participantes, o usuário pode consultar as opções disponíveis e reservar um espaço compatível. O sistema acompanha o comparecimento, registra presenças e libera reservas sem check-in após a tolerância definida.

A recomendação inteligente é **baseada em regras de capacidade, disponibilidade e horários**: prioriza a menor sala que atende ao grupo. Não se trata de um modelo de IA treinado nem de previsão estatística de demanda.

### Fluxo principal

1. O usuário cria uma conta acadêmica e faz login.
2. Consulta o catálogo ou solicita uma recomendação para determinado grupo e período.
3. Confirma a reserva; o backend valida funcionamento, capacidade e conflitos.
4. O sistema gera um token de check-in, exibe o QR Code na área **Minhas reservas** e prepara a notificação por e-mail.
5. Participantes podem abrir o link do QR Code no celular e confirmar a presença, inclusive sem login, conforme a implementação acadêmica atual.
6. O primeiro check-in válido altera a reserva para **`em_uso`** e registra a presença.
7. Caso a reserva permaneça sem check-in até o limite de tolerância, torna-se **`expirada`**, liberando o espaço para novas reservas compatíveis.

## 2. Funcionalidades implementadas

### Frontend — interface do usuário
- Login e cadastro de usuários, com validações de formulário.
- Catálogo de salas com capacidade, localização, horários e estado atual.
- Detalhes expansíveis por cartão e navegação responsiva.
- Formulário de reserva com seleção de sala, intervalo, participantes, título e descrição.
- Consulta de salas recomendadas para o intervalo selecionado.
- Histórico de reservas, filtros por situação e cancelamento de reservas futuras elegíveis.
- Exibição e cópia do link/QR Code da reserva.
- Página de check-in com confirmação de presença; leitor de câmera no navegador quando disponível em um contexto seguro.
- Interface em HTML, CSS e JavaScript puro, sem etapa de compilação.

### Backend — API e regras de negócio
- API REST em **Node.js + Express**.
- Cadastro, autenticação por JWT e controle de acesso para rotas de usuário e administrador.
- Senhas com hash **bcrypt**; RA validado com nove dígitos e protegido em armazenamento.
- Consulta e recomendação de salas segundo capacidade, período e disponibilidade.
- Criação de reservas com verificação de conflitos e controle transacional no banco.
- Acompanhamento dos estados: `confirmada`, `em_uso`, `expirada`, `cancelada` e `concluida`.
- Check-in via token de QR Code e registros em `checkins` e `presencas`.
- Atualização de situação e expiração de reservas sem presença após período de tolerância.
- Endpoints administrativos de listagem e estatísticas de uso.

### Integrações — QR Code e notificações
- Geração de QR Code no próprio backend.
- Geração de imagem PNG para incorporação ao e-mail de confirmação.
- Envio SMTP opcional, com autenticação e validação de certificados TLS.
- Cópia local de notificação na pasta `backend/outbox/` para desenvolvimento.
- Link direto de check-in como alternativa à leitura do QR Code.

**Nota:** o provedor de e-mail pode classificar mensagens de teste como spam ou restringir inicialmente a exibição de imagens. O envio depende de configuração SMTP válida; sem ela, a notificação fica apenas na `outbox`.

## 3. Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | HTML5, CSS3, JavaScript (sem framework) |
| API | Node.js 20+, Express 5 |
| Autenticação e proteção de dados | JWT, bcryptjs, HMAC para índice de RA |
| Banco | MariaDB/MySQL, com `mysql2` |
| Desenvolvimento local | VS Code, Live Server, XAMPP/phpMyAdmin |
| QR Code e e-mail | Gerador local de SVG, `sharp` para PNG, SMTP |
| Controle de versão | Git e GitHub |
| Testes | Executor nativo de testes do Node.js (`node --test`) |

## 4. Estrutura do repositório

```text
CampusFlow/
├── frontend/
│   ├── index.html                 # Login
│   ├── pages/
│   │   ├── cadastro.html
│   │   ├── salas.html
│   │   ├── reservar-sala.html
│   │   ├── minhas-reservas.html
│   │   └── checkin.html
│   └── assets/
│       ├── css/                  # Estilos e responsividade
│       ├── js/                   # Interface, API e fluxos de navegação
│       └── img/
├── backend/
│   ├── .env.example              # Modelo de configuração (sem credenciais reais)
│   ├── package.json
│   ├── src/
│   │   ├── app.js                # Middleware, CORS e rotas
│   │   ├── server.js             # Inicialização e rotina de status
│   │   ├── config/               # Banco de dados
│   │   ├── middleware/           # Autenticação/autorização
│   │   ├── rotas/                # Auth, salas, reservas e admin
│   │   ├── services/             # E-mail e atualização de reservas
│   │   └── utils/                # Datas, QR Code, RA, recomendação, métricas
│   ├── scripts/                  # Administração e migrações
│   └── tests/                    # Testes automatizados da API e regras
├── banco/
│   └── campusflow.sql            # Esquema e salas de demonstração
├── docs/                         # Notas e registros técnicos das etapas
├── tests/                        # Materiais de testes de integração
└── README.md
```

## 5. Executar localmente (Windows / PowerShell)

### Pré-requisitos

- **Node.js 20 ou superior** e npm.
- **XAMPP** com MariaDB/MySQL iniciado. Apache só é necessário para usar o phpMyAdmin pelo navegador.
- **VS Code** e Live Server (ou outro servidor estático) para o frontend.
- Navegador moderno; celular na mesma rede Wi-Fi é opcional para testar QR Code.

### 5.1. Preparar o banco

1. No XAMPP, inicie **MySQL**; inicie **Apache** se for usar o phpMyAdmin.
2. Acesse `http://localhost/phpmyadmin`.
3. Importe `banco/campusflow.sql` na aba **Importar** ou execute o conteúdo pela aba **SQL**.
4. Confira o banco `campusflow` com as tabelas `usuarios`, `salas`, `reservas`, `checkins` e `presencas`.

O SQL inclui cinco salas **fictícias** para demonstração: 101, 102, 201, 202 e 301.

### 5.2. Instalar e configurar o backend

No terminal, a partir da raiz do projeto:

```powershell
cd backend
npm.cmd ci
Copy-Item .env.example .env
```

Edite `backend/.env` com as credenciais do banco, as URLs de desenvolvimento e os segredos privados. Exemplo **sem credenciais reais**:

```dotenv
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=campusflow

FRONTEND_ORIGIN=http://127.0.0.1:5500,http://localhost:5500
FRONTEND_URL=http://127.0.0.1:5500/frontend

JWT_SECRET=GERAR_SEGREDO_PRIVADO
RA_PEPPER=GERAR_OUTRO_SEGREDO_PRIVADO
GRACE_SECONDS=600
```

`DB_USER=root` sem senha é **somente para laboratório local**, caso corresponda à sua instalação. Em produção, use um usuário próprio com permissões mínimas.

Gere **dois valores diferentes**, um para `JWT_SECRET` e outro para `RA_PEPPER`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Execute duas vezes. **Não reutilize os valores, não os publique e não troque `RA_PEPPER` depois de já cadastrar usuários sem planejar a migração correspondente.**

Para ativar e-mails reais, preencha também `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` conforme o `.env.example`. Com Gmail, a conta remetente pode exigir senha de app e autenticação em duas etapas.

Inicie a API:

```powershell
npm.cmd run dev
```

Verifique `http://127.0.0.1:3001/api/health`. Com o banco conectado, a resposta inclui:

```json
{"status":"ok","servico":"campusflow-api","banco":"conectado"}
```

### 5.3. Iniciar o frontend

Em **outro terminal**, volte à raiz do repositório, não à pasta `frontend`:

```powershell
npx.cmd live-server --host=0.0.0.0 --port=5500 --no-browser
```

Abra:

**`http://127.0.0.1:5500/frontend/index.html`**

As telas internas estão em `/frontend/pages/`. O frontend é servido na porta **5500**; a API responde na porta **3001**.

### 5.4. Acessar pelo celular na mesma rede

Para o QR Code abrir no smartphone:

1. Descubra o IPv4 do computador executando `ipconfig`.
2. Confira o acesso ao frontend em `http://SEU_IP:5500/frontend/index.html` e à API em `http://SEU_IP:3001/api/health`.
3. No `backend/.env`, configure `FRONTEND_URL=http://SEU_IP:5500/frontend` e inclua `http://SEU_IP:5500` em `FRONTEND_ORIGIN`.
4. Reinicie o backend e gere o QR Code novamente.
5. Use a **câmera nativa** do celular para ler o QR Code apresentado no computador.

**Atenção:** o leitor de câmera *dentro do navegador* normalmente exige **HTTPS** ou contexto seguro; o endereço HTTP com IP privado não atende a esse requisito no Chrome. Para testes locais, use a câmera nativa. Na futura publicação, configurar HTTPS e ajustar a URL da API do frontend.

## 6. Regras principais

- Cada sala tem capacidade e horário de funcionamento; reservas devem respeitar ambos.
- O servidor rejeita períodos inválidos, passados e conflitantes.
- Recomendações retornam salas compatíveis, priorizando menor capacidade suficiente.
- Reservas confirmadas bloqueiam o intervalo; expiradas e canceladas deixam de bloqueá-lo.
- O check-in abre até **15 minutos antes do início**; a primeira confirmação deve ocorrer antes de vencer a tolerância de **10 minutos após o início** (padrão: `GRACE_SECONDS=600`).
- O primeiro check-in altera o status para `em_uso`; ao fim do intervalo, reservas em uso podem passar para `concluida`.
- A API atualiza situações periodicamente enquanto está ativa e também nas operações pertinentes.
- Datas são tratadas conforme o fuso do campus e armazenadas em UTC no banco.

## 7. Endpoints principais da API

Base local: `http://localhost:3001/api`.

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/health` | Verifica API e banco |
| POST | `/auth/cadastro` | Cria conta |
| POST | `/auth/login` | Autentica e devolve JWT |
| GET | `/auth/me` | Dados do usuário autenticado |
| GET | `/salas` | Catálogo e estado atual das salas |
| GET | `/salas/recomendadas` | Recomendação por período e tamanho do grupo |
| POST | `/reservas` | Cria uma reserva autenticada |
| GET | `/reservas/minhas` | Histórico do usuário |
| GET | `/reservas/:id/qrcode` | QR Code da reserva (titular ou admin) |
| POST | `/reservas/:id/cancelar` | Cancela reserva futura elegível |
| POST | `/checkin` | Confirma presença com token de QR Code |
| GET | `/admin/reservas` | Lista administrativa (admin) |
| GET | `/admin/estatisticas` | Indicadores agregados (admin) |

Rotas protegidas exigem o cabeçalho `Authorization: Bearer TOKEN`. O fluxo acadêmico atual aceita check-in pelo token sem autenticação obrigatória do participante.

Para criar um administrador **localmente**, depois de cadastrar um usuário:

```powershell
cd backend
npm.cmd run admin -- NOME_DE_USUARIO
```

Faça login novamente para usar as rotas administrativas. A API administrativa existe; **não há um painel administrativo visual completo** documentado nesta versão.

## 8. Banco de dados

| Tabela | Finalidade |
| --- | --- |
| `usuarios` | Contas, credenciais e perfil |
| `salas` | Capacidade, prédio, horário e disponibilidade |
| `reservas` | Períodos, responsáveis, situações e token protegido |
| `checkins` | Primeiro check-in de cada reserva |
| `presencas` | Comparecimento individual, inclusive participantes sem login |

As cinco salas inicialmente cadastradas são exemplos para apresentação acadêmica e devem ser substituídas por dados autorizados antes de uso institucional.

## 9. Testes e validação

**Backend:** na pasta `backend`, executar:

```powershell
npm.cmd test
```

Na validação local reportada pelo grupo em novembro de 2026, **20 testes automatizados passaram**. Eles abrangem regras de horários, recomendação, RA, QR Code, estatísticas e geração de notificações. Esse resultado não substitui testes de integração em produção.

**Frontend:** os fluxos principais foram verificados **manualmente** em navegadores e celular: cadastro, login, salas, reservas, cancelamentos, QR Code, confirmação de presença, expiração e liberação da sala. Esta versão **não possui uma suíte automatizada de testes do frontend configurada**.

A integração completa foi validada com o backend Node.js e o MariaDB executados localmente. É necessário repetir os testes após configurar a hospedagem pública.

## 10. Segurança, privacidade e limites conhecidos

- Não comitar `.env`, senhas SMTP, segredos JWT, `RA_PEPPER`, `node_modules/`, arquivos de `outbox/` ou QR Codes contendo tokens reais.
- O RA tem nove dígitos, é protegido por hash e possui índice HMAC para unicidade; senhas são armazenadas com bcrypt.
- A API restringe CORS às origens definidas em `FRONTEND_ORIGIN`. **CORS não substitui autenticação e autorização.**
- A conexão SMTP valida certificados TLS. O QR Code do e-mail é gerado localmente e incorporado à mensagem.
- O token de login é armazenado pelo frontend em `sessionStorage`, o que **não elimina risco de XSS**. Para uma implantação pública real, revisar política de sessão, proteção contra abuso, retenção de dados e exigências da LGPD.
- A confirmação por link de QR Code **não comprova localização física**, pois o token pode ser compartilhado. Não utilizar o protótipo como mecanismo institucional de frequência sem controles adicionais.
- O envio SMTP não possui fila persistente de reenvio garantido. Uma reserva pode ser registrada mesmo se a notificação falhar.
- A publicação com HTTPS, banco gerenciado, segredos em ambiente seguro e ajustes de URLs da API **ainda não está incluída nesta versão local**.

## 11. Organização do trabalho em grupo

O projeto foi construído em frentes complementares:

- **Frontend e experiência do usuário:** telas, responsividade, navegação, formulários e consumo da API.
- **Backend e banco de dados:** autenticação, persistência, reservas, regras de negócio, recomendação e indicadores.
- **Integração e automação:** QR Code, check-in, presenças, notificações e validação dos fluxos de ponta a ponta.

Os módulos estão integrados em um único repositório. Os registros técnicos de desenvolvimento encontram-se em `docs/`.

## 12. Próximas etapas

1. Configurar hospedagem pública para frontend, API e MariaDB/MySQL, com **HTTPS** e URLs apropriadas.
2. Revisar controles de segurança e privacidade antes de aceitar dados reais.
3. Reexecutar testes funcionais e de integração na infraestrutura publicada.
4. Preparar evidências, relatório acadêmico definitivo e apresentação do grupo.

---

**CampusFlow — Sistemas Computacionais · UNESP**  
Projeto acadêmico para demonstrar gestão de salas, recomendação por regras e confirmação de presença.
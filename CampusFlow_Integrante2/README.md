# CampusFlow — Integrante 2: Backend e banco de dados

Primeira entrega **executável localmente** da API do sistema de reservas de salas.

## 1. Escopo implementado

- Banco de dados MariaDB/MySQL, administrável no phpMyAdmin do XAMPP.
- Cinco salas de demonstração, cada uma com prédio, capacidade e horário.
- Cadastro e login de alunos com senha protegida por hash bcrypt.
- JWT de acesso para chamadas da API (perfil de administrador criado apenas via comando local).
- Consulta das salas e de seu estado atual: livre, reservada ou em uso.
- Reserva com validação de capacidade, funcionamento e conflito de horário.
- Transações com `SELECT ... FOR UPDATE` para impedir confirmações conflitantes simultâneas.
- Listagem e cancelamento de reservas próprias.
- Recomendação automática da menor sala disponível que acomode o grupo.
- Atualização de reserva não confirmada para `expirada` após dez minutos, sem apagar o histórico.
- Consulta administrativa de reservas e estatísticas básicas.
- Testes unitários de regras de período e recomendação.

**Ainda não implementado (integrante 3):** envio de e-mails, geração e leitura de QR Code e registro de check-in. As tabelas e campos necessários já foram preparados, mas não há mecanismo de leitura ativo ainda. Não confunda `status: confirmada` (reserva aceita no banco) com presença comprovada.

## 2. Requisitos para executar

- **XAMPP** com os serviços **Apache** e **MySQL/MariaDB** iniciados. O Apache é utilizado para abrir a interface phpMyAdmin; a conexão da API é diretamente com MariaDB.
- **Node.js 20 ou superior** e npm.
- Navegador e, opcionalmente, **Postman** (ou extensão REST Client do VS Code) para testar rotas.

## 3. Criar o banco no phpMyAdmin

1. Abra o painel do XAMPP e inicie **Apache** e **MySQL**.
2. Acesse `http://localhost/phpmyadmin` no navegador.
3. Use a aba **Importar**, selecione `banco/campusflow.sql` e execute. Se necessário, abra a aba **SQL** e cole o conteúdo do arquivo.
4. Confirme que o banco `campusflow` contém as tabelas `usuarios`, `salas`, `reservas` e `checkins`.
5. Abra `salas > Procurar` e confira as cinco salas fictícias.

O arquivo é reexecutável para criar tabelas ausentes e inserir salas ainda não existentes, sem destruir registros anteriores. Não use `DROP DATABASE` em um banco com dados úteis.

## 4. Configurar e iniciar a API

Abra um terminal **dentro da pasta `backend`**:

```powershell
npm install
copy .env.example .env
```

Abra `.env` e configure:

- `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=campusflow`.
- `DB_USER=root` e `DB_PASSWORD=` apenas se estiver usando a configuração local padrão do XAMPP, sem senha. Se seu banco tem senha, informe-a. **Não use root nem senha vazia na publicação pública.**
- Troque `JWT_SECRET` por uma sequência aleatória de pelo menos 32 caracteres. Para gerar uma:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Depois execute:

```powershell
npm run dev
```

A API inicia, por padrão, em `http://localhost:3001`.

Acesse `http://localhost:3001/api/health`. Uma resposta esperada com o banco conectado é:

```json
{ "status": "ok", "servico": "campusflow-api", "banco": "conectado" }
```

**Importante:** a API devolve **JSON**, não páginas HTML. As telas serão desenvolvidas pelo integrante 1.

## 5. Testar cadastro, login e reservas com Postman

Os exemplos abaixo podem ser usados no **Postman**, sempre selecionando o método indicado e `Body > raw > JSON` quando existir corpo.

### 5.1. Criar aluno

`POST http://localhost:3001/api/auth/cadastro`

```json
{
  "nome_completo": "Estudante Demonstração",
  "nome_usuario": "aluno_teste",
  "email": "aluno.teste@example.com",
  "ra": "20260001",
  "telefone": "(15) 99999-9999",
  "senha": "senhaDeTeste123"
}
```

Os dados são fictícios. O perfil criado será sempre `aluno`.

### 5.2. Fazer login

`POST http://localhost:3001/api/auth/login`

```json
{
  "nome_usuario": "aluno_teste",
  "senha": "senhaDeTeste123"
}
```

Copie o `token` devolvido pela API. Nas próximas requisições, adicione o cabeçalho:

`Authorization: Bearer COLE_SEU_TOKEN_AQUI`

Em Postman, também é possível selecionar `Authorization > Bearer Token`.

### 5.3. Listar salas

`GET http://localhost:3001/api/salas`

Deve listar cinco salas com informações do horário e capacidade.

### 5.4. Pedir recomendações para 12 pessoas

`GET http://localhost:3001/api/salas/recomendadas?inicio=2026-12-15T14%3A00%3A00-03%3A00&fim=2026-12-15T16%3A00%3A00-03%3A00&pessoas=12`

**Atenção:** use uma **data futura** em relação à execução. O horário na URL está codificado (`%3A` representa `:`). O filtro devolve apenas salas disponíveis, ordenadas pela menor capacidade. Em um intervalo vazio, a Sala 101 (15 lugares) é a melhor opção para 12 pessoas, com 80% de aproveitamento.

### 5.5. Registrar uma reserva

`POST http://localhost:3001/api/reservas`

```json
{
  "sala_id": 1,
  "inicio": "2026-12-15T14:00:00-03:00",
  "fim": "2026-12-15T16:00:00-03:00",
  "pessoas": 12,
  "titulo": "Grupo de estudos",
  "descricao": "Revisão de Sistemas Computacionais",
  "nomes_participantes": "Pessoa A, Pessoa B, Pessoa C"
}
```

A reserva confirmada devolve HTTP **201**. Faça o mesmo pedido novamente para a mesma sala e horário e espere **409** (conflito).

Os campos nome, RA e telefone do responsável são recuperados do cadastro autenticado, para não permitir que alguém crie uma reserva se passando por outra pessoa.

### 5.6. Consultar suas reservas

`GET http://localhost:3001/api/reservas/minhas`

### 5.7. Cancelar uma reserva futura

`POST http://localhost:3001/api/reservas/1/cancelar` (substitua `1` pelo ID real)

### 5.8. Transformar um usuário em administrador

Depois de cadastrá-lo, execute no terminal `backend`:

```powershell
npm run admin -- aluno_teste
```

Faça **novo login** e acesse:

- `GET http://localhost:3001/api/admin/reservas`
- `GET http://localhost:3001/api/admin/estatisticas`

## 6. Regras de negócio

- Reservas em horários passados ou com fim anterior ao início são rejeitadas.
- Nesta primeira versão, o agendamento precisa começar e terminar **no mesmo dia do campus**, respeitando o horário da sala.
- Um conflito existe quando: `reserva_existente.inicio < novo_fim` **e** `reserva_existente.fim > novo_inicio`, para reservas com status `confirmada` ou `em_uso`.
- Quando uma reserva confirmada não recebe check-in até **10 minutos após o início**, seu status é alterado para `expirada` e ela não bloqueia mais reservas. O registro continua no histórico.
- Na API local, o processo de atualização de status roda periodicamente (15 segundos) e antes das consultas e tentativas de reserva. Na publicação, deverá haver rotina agendada em infraestrutura que não dependa de um processo permanentemente ativo; a validação sob demanda permanece obrigatória.
- Uma reserva com check-in (`em_uso`) passa para `concluida` ao fim do horário. A mudança para `em_uso` ficará com o módulo de QR Code.
- Recomendações são **baseadas em regras de capacidade e disponibilidade**, não em previsão estatística nem em IA treinada. Histórico e previsões podem ser incluídos depois.
- Horários enviados à API **devem trazer fuso** (por exemplo `-03:00`). Internamente são gravados em UTC no MariaDB, evitando dependência do relógio da máquina hospedeira.

## 7. Organização do projeto

```text
CampusFlow_Integrante2/
├── banco/
│   └── campusflow.sql
├── backend/
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/db.js
│   │   ├── middleware/autenticacao.js
│   │   ├── rotas/auth.js
│   │   ├── rotas/salas.js
│   │   ├── rotas/reservas.js
│   │   ├── rotas/admin.js
│   │   ├── services/statusReservas.js
│   │   └── utils/{datas,erros,recomendacao}.js
│   ├── scripts/tornar-admin.js
│   └── tests/regras.test.js
└── README.md
```

## 8. Testes e limitações

```powershell
cd backend
npm test
```

Os testes unitários podem rodar sem o MariaDB estar ligado. Os **testes de integração** (conexão real, cadastro, reservas concorrentes e cron) devem ser executados no XAMPP do grupo; o código ainda não foi validado contra uma instância real desse banco nesta entrega.

Antes de qualquer publicação pública, evoluir a segurança com usuário de banco específico com permissões mínimas, HTTPS, proteção contra abuso do login (limite de tentativas), política de senhas, gestão segura do JWT (idealmente cookies HttpOnly na integração web), retenção de dados e revisão LGPD.

Também não é seguro disponibilizar o painel do XAMPP/phpMyAdmin na internet. Na publicação, a API e o banco devem usar hospedagem e configurações adequadas. **XAMPP é ambiente local de desenvolvimento.**

## 9. Integração com os integrantes 1 e 3

**Integrante 1 (frontend):** consome rotas REST, guarda o estado de autenticação, mostra salas e recomendação e envia o formulário da reserva. A resposta 201 confirma a reserva; 409 pede outro horário.

**Integrante 3 (QR/e-mails):** após a criação bem-sucedida de uma reserva, integrar serviço de notificação e geração de token QR seguro; salvar **apenas hash** em `reservas.qr_token_hash`, não expor token em listagens e validar QR dentro do prazo por um usuário autorizado. O check-in deverá registrar linha na tabela `checkins`, alterar `status` para `em_uso` e associar o validador. Para evitar disputas, usar transação e bloquear sala/reserva consistentemente. O envio de e-mail deve ser desacoplado do `COMMIT` (idealmente fila/outbox), com reenvio em caso de falha.

## 10. Referências oficiais úteis

- XAMPP: https://www.apachefriends.org/
- Express: https://expressjs.com/en/5x/guide/routing/
- mysql2: https://sidorares.github.io/node-mysql2/docs/examples/connections/create-pool

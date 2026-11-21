# CampusFlow — RA com 9 dígitos e armazenamento protegido

## Objetivo

- Receber RA como **string de exatamente nove dígitos ASCII**, inclusive com zero à esquerda.
- Não gravar o RA original no MariaDB.
- Guardar em `usuarios.ra` um **hash bcrypt** do RA com HMAC de uma chave do servidor (pepper) antes do bcrypt.
- Guardar em `usuarios.ra_indice` um **HMAC-SHA256** do RA para impedir cadastro duplicado com índice único.
- Guardar em `reservas.responsavel_ra` **apenas uma cópia do hash** do usuário. O RA legível não aparece no login, em `/api/auth/me`, nem em `/api/admin/reservas`.
- Manter a senha de login (`senha_hash`) independente do RA.

> Hash é unidirecional; não é possível recuperar o RA para impressão ou envio por e-mail. Esta é uma decisão de privacidade deliberada. Para mostrar ou enviar o RA original futuramente, será preciso uma decisão de produto e uma arquitetura de criptografia autenticada com controles de acesso; não substitua o hash por texto puro.

## Etapa A — backup e parada do backend

1. Antes de executar qualquer migração, faça **Exportar → SQL** do banco `campusflow` no phpMyAdmin. Guarde o backup em local protegido e FORA do repositório Git (o backup antigo contém RAs em texto claro).
2. Pare a API (`Ctrl+C` no terminal do `npm.cmd run dev`). Mantenha o MariaDB do XAMPP ligado.
3. Confira a branch e um Git sem mudanças inesperadas; copie os arquivos do pacote desta alteração para o repositório.
4. **Não reimporte `banco/campusflow.sql` sobre o banco atual.** Esse arquivo foi atualizado para *instalações novas*; um `CREATE TABLE IF NOT EXISTS` não altera tabelas existentes. A migração existente será realizada pelo script Node, preservando usuários e reservas.

## Etapa B — configure o segredo no `.env`

No terminal PowerShell, em `CampusFlow/backend`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Adicione ao seu `.env` (não ao `.env.example`) uma linha assim, substituindo pelo resultado:

```dotenv
RA_PEPPER=COLE_AQUI_OS_64_CARACTERES_HEXADECIMAIS_GERADOS
```

Mantenha `JWT_SECRET` como está; são dois segredos diferentes. Não publique o `RA_PEPPER` e **não o troque depois de cadastrar RAs**, pois a validação de duplicidade/identificadores depende dele. Para recuperação de desastre, proteja também uma cópia desse segredo fora do Git.

## Etapa C — corrija os usuários com RAs antigos

Você criou anteriormente usuários demonstrativos (`aluno_teste` e `admin_teste`) com RAs de oito dígitos. É necessário fornecer um novo RA de **nove dígitos para cada conta afetada**; a migração não adiciona zeros automaticamente.

Na pasta `backend`, crie um arquivo temporário `ra-migracao.local.json` com valores de exemplo *somente para essas contas fictícias*:

```json
{
  "aluno_teste": "202600001",
  "admin_teste": "202600002"
}
```

Se houver outras contas com RA antigo, inclua seus `nome_usuario` e os RAs corretos. Se alguma conta já tiver RA válido de nove dígitos, não será necessário mapeá-la. **RAs reais devem ser obtidos do titular; nunca invente ou complete números reais.**

Esse arquivo contém dados sensíveis em claro: fica ignorado pelo `backend/.gitignore`. Verifique se não entrou no staging:

```powershell
git check-ignore backend/ra-migracao.local.json
```

## Etapa D — execute a migração preservando os registros

Na pasta `backend`:

```powershell
npm.cmd run migrar-ra -- ra-migracao.local.json
```

O script valida todos os RAs e a inexistência de duplicidades **antes de começar as alterações**. Depois, amplia as colunas no banco, transforma os RAs em hashes, migra a cópia do RA das reservas e cria o índice único `uq_usuarios_ra_indice`.

Se algum usuário ainda tiver RA inválido ou houver dois RAs iguais, a migração termina com erro **sem modificar registros** (desde que a validação falhe antes das alterações). Problemas durante um `ALTER TABLE` exigem consultar o backup: DDL no MariaDB realiza commits implícitos; portanto, mantenha o backend desligado durante todo o processo.

Quando terminar e estiver tudo correto, apague o arquivo temporário **após validar que não precisa usá-lo novamente**:

```powershell
Remove-Item .\ra-migracao.local.json
```

## Etapa E — testes

Ainda na pasta `backend`:

```powershell
npm.cmd test
npm.cmd run dev
```

No phpMyAdmin, execute **somente estas consultas sem conteúdo sigiloso**:

```sql
SELECT nome_usuario, LENGTH(ra) AS tamanho_hash,
       LENGTH(ra_indice) AS tamanho_indice
FROM usuarios;

SELECT id, LENGTH(responsavel_ra) AS tamanho_hash
FROM reservas;
```

Valores esperados: `tamanho_hash` **60**, `tamanho_indice` **64**. Isso é consistente com o formato bcrypt, mas o teste completo de integração inclui cadastrar um RA válido, rejeitar RA de oito dígitos e rejeitar um RA duplicado.

Recomendamos validar:

1. Login das contas existentes (mesma senha de antes).
2. `POST /api/auth/cadastro` com RA `012345678` como **string** deve funcionar (se não estiver cadastrado).
3. `POST /api/auth/cadastro` com RA `12345678` deve retornar HTTP 422.
4. Outro cadastro com RA `012345678` deve retornar HTTP 409.
5. `/api/auth/login` e `/api/auth/me` **não retornam `ra`**, mas retornam `ra_cadastrado: true`.
6. `/api/admin/reservas` não expõe RA; novas reservas gravam `responsavel_ra` como hash.

## O que muda para o frontend

- O formulário de cadastro envia `ra` como **string de nove dígitos**. Use `type="text"`, `inputmode="numeric"`, `maxlength="9"`, `pattern="[0-9]{9}"`. Evite `type="number"` para conservar zeros à esquerda.
- O frontend não pode esperar um campo `usuario.ra` em login/perfil. Recebe `ra_cadastrado: true` e poderá mostrar `RA protegido` sem revelar o número.
- A API continua usando `usuario_id` para vincular reservas. Não envie o RA no corpo de `POST /api/reservas`.
- O novo contrato deve substituir qualquer documentação antiga que exemplifique RA de oito dígitos ou mostre RA em respostas JSON.

## Limitação relevante

Um RA de nove dígitos tem baixa entropia se for tratado como **senha de acesso**. Esta alteração protege o RA armazenado, **mas o RA não substitui a senha forte de login**. O segredo do servidor (pepper), o controle de acesso ao banco e o backup protegido continuam essenciais.

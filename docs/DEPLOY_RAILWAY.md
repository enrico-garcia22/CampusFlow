# Publicação do CampusFlow com Railway

Esta preparação coloca o frontend e a API no **mesmo domínio HTTPS**, em um serviço web Node.js, ligado a um banco **MySQL privado**. O Dockerfile está na raiz do repositório.

## 1. Criar projeto e serviços
1. Acesse https://railway.com/ e crie um projeto chamado CampusFlow.
2. Adicione **Database > MySQL**. Não habilite TCP Proxy público; use a rede privada entre serviços.
3. Adicione um serviço **GitHub Repository** e selecione o repositório privado `enrico-garcia22/CampusFlow`.
4. Use a branch `deploy/railway-https` para homologação ou `main` depois de revisado o Pull Request.
5. Mantenha o **Root Directory** em `/`, para que o Railway utilize o `Dockerfile` da raiz.

## 2. Variáveis privadas do serviço WEB

| Variável | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DB_HOST` | Referência ao `MYSQLHOST` do serviço MySQL |
| `DB_PORT` | Referência ao `MYSQLPORT` |
| `DB_USER` | Referência ao `MYSQLUSER` |
| `DB_PASSWORD` | Referência ao `MYSQLPASSWORD` |
| `DB_NAME` | Referência ao `MYSQLDATABASE` |
| `JWT_SECRET` | Segredo privado aleatório de 64 caracteres hexadecimais |
| `RA_PEPPER` | Outro segredo privado, diferente do JWT |
| `GRACE_SECONDS` | `600` |
| `DB_INIT_ON_START` | `true` somente no primeiro provisionamento de banco vazio |
| `ENABLE_STATUS_TIMER` | `false` para evitar consumo contínuo em serviço serverless |

Use **Add Reference Variable** para apontar cada `DB_*` à variável equivalente do serviço MySQL. Por exemplo, `DB_HOST` deve referenciar a variável `MYSQLHOST`, não conter um endereço fictício.

Para gerar os dois segredos, execute **duas vezes**, no seu computador:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Não copie segredos para o chat ou para o repositório. **Não fixe `PORT`**: o Railway fornece a porta automaticamente.

## 3. Endereço público HTTPS
1. No serviço web, abra **Settings > Networking > Public Networking > Generate Domain**.
2. Copie o domínio real fornecido pelo Railway.
3. Configure `FRONTEND_ORIGIN=https://DOMINIO_REAL` e `FRONTEND_URL=https://DOMINIO_REAL/frontend`.
4. Faça deploy/redeploy depois de salvar.

Endereços esperados:
- `https://DOMINIO_REAL/frontend/index.html` — interface.
- `https://DOMINIO_REAL/api/health` — API com banco conectado.

O frontend publicado usa `/api` na **mesma origem HTTPS**, evitando porta `3001` pública e conteúdo misto.

## 4. Inicializar banco e dados de demonstração
Na primeira execução, `DB_INIT_ON_START=true` importa as tabelas do arquivo `banco/campusflow.sql` para o banco MySQL fornecido pelo Railway, criando as cinco salas fictícias de demonstração. Após verificar que `/api/health` retorna o banco conectado, altere `DB_INIT_ON_START=false` e redeploy.

O banco remoto começa **vazio**: usuários e reservas locais do XAMPP não são importados automaticamente, evitando publicar dados pessoais de teste.

## 5. Envio de e-mail
**Importante:** nos planos Free, Trial e Hobby, o Railway bloqueia SMTP de saída. As variáveis `SMTP_*` que funcionaram localmente **não garantem envio no Railway**.

O backend oferece uma alternativa opcional de e-mail pela API HTTPS do Resend:
1. Crie uma conta em https://resend.com/ e configure/remeta por domínio verificado. Contas de teste podem limitar destinatários.
2. Configure no serviço web as variáveis `RESEND_API_KEY` e `RESEND_FROM` (um remetente verificado).
3. Faça uma nova reserva de teste e confirme recebimento, imagem QR Code e leitura via HTTPS.

Se não configurar Resend, a criação de reservas e a exibição do QR Code na interface podem funcionar, mas o e-mail real ficará pendente de validação na hospedagem.

## 6. Checklist de homologação
- [ ] `/api/health` retorna JSON com banco conectado.
- [ ] O login abre por HTTPS, inclusive no celular.
- [ ] Cadastro, autenticação e catálogo de salas funcionam com dados fictícios.
- [ ] Uma reserva é criada e um conflito é bloqueado.
- [ ] A recomendação retorna sala de capacidade adequada.
- [ ] QR Code abre `/frontend/pages/checkin.html` no domínio HTTPS.
- [ ] A primeira presença altera a reserva para `em_uso`.
- [ ] Reserva sem presença expira e libera a sala.
- [ ] E-mail com QR Code chega ao destinatário, se Resend foi configurado.
- [ ] A interface de câmera solicita permissão quando suportada pelo navegador.
- [ ] Não há `.env`, segredos, logs ou `outbox` publicados no repositório.

## 7. Limitações e custos
No plano gratuito o Railway utiliza créditos e pode colocar aplicações inativas para dormir. O CampusFlow conserva a atualização de status sob demanda, sem depender exclusivamente do timer de 15 segundos. Antes do uso institucional, revisar retenção/LGPD, controle de abuso, backups e confirmação de presença física; o QR Code pode ser compartilhado.

Referências: https://docs.railway.com/builds/dockerfiles ; https://docs.railway.com/databases/mysql ; https://docs.railway.com/pricing/free-plan ; https://docs.railway.com/networking/outbound-networking .

# CampusFlow — Automação com QR Code e Verificação de Presença

Implementação da automação de verificação de presença por QR Code (**Integrante 3 — Tico**).

---

## 1. Visão Geral da Solução

O objetivo desta funcionalidade é combater as **reservas fantasmas** e medir o **aproveitamento real** das salas e laboratórios do campus universitário com dados concretos:

1. **Criação da Reserva:** Ao registrar um agendamento com a quantidade estimada de participantes, a API gera automaticamente um token criptográfico unívoco assinado e armazena **apenas o hash SHA-256** em `reservas.qr_token_hash`.
2. **Automação de Notificação (E-mail com QR Code):** Imediatamente após a confirmação da reserva, um serviço assíncrono gera um e-mail formatado contendo os dados do espaço, instruções de uso, link direto e o **QR Code incorporado em SVG**. Em ambiente de desenvolvimento local, o e-mail é gravado automaticamente na pasta `backend/outbox/` como `.html` interativo e `.json`.
3. **No dia da atividade:** O professor ou organizador pode abrir o e-mail ou clicar em **"Ver QR Code"** na tela *Minhas Reservas* para projetar o código na sala.
4. **Validação de Presença pelos Participantes:** Alunos e participantes escaneiam o QR Code com a câmera do celular ou acessam o link de check-in (`pages/checkin.html?token=...`).
5. **Transição de Status & Registro de Frequência:**
   - O primeiro check-in ativa a sala, alterando o status de `confirmada` para `em_uso` e inserindo o validador na tabela `checkins`.
   - Cada participante que escaneia tem sua presença individual contabilizada na tabela `presencas`.
   - Impede que a reserva expire por falta de uso após os 10 minutos de tolerância.
6. **Métricas Concretas de Uso:** Os dados alimentam o endpoint `/api/admin/estatisticas` com taxas reais de comparecimento e aproveitamento de espaço vs. estimativa original.

---

## 2. Componentes Criados e Atualizados

| Arquivo | Finalidade |
| --- | --- |
| `backend/src/utils/qrcode.js` | Geração de token HMAC seguro, cálculo de hash SHA-256 e renderizador puro de matriz QR Code padrão ISO/IEC 18004 em SVG/DataURI (independente de libs nativas). |
| `backend/src/services/emailService.js` | Construtor do template HTML de notificação e gravação em `backend/outbox/` (desacoplado da transação do banco). |
| `backend/src/rotas/reservas.js` | Atualizado para salvar `qr_token_hash`, disparar notificação, expor `GET /:id/qrcode` e validar check-ins em `POST /checkin`. |
| `backend/src/app.js` | Roteamento unificado para `/api/checkin` e `/api/reservas/checkin`. |
| `banco/campusflow.sql` | Adição da tabela `presencas` com chave única por reserva/aluno para contagem individual de participantes. |
| `frontend/pages/checkin.html` | Interface responsiva para alunos escanearem/validarem presença com leitura de câmera ou link. |
| `frontend/assets/js/checkin.js` | Lógica de validação de token, suporte a câmera nativa com BarcodeDetector e feedback em tempo real. |
| `frontend/pages/minhas-reservas.html` | Modal para projeção e visualização do QR Code com contador de presentes. |
| `frontend/assets/js/minhas-reservas.js` | Botão interativo *Ver QR Code* e cópia do link de check-in. |
| `frontend/assets/js/api.js` | Métodos `obterQrCode(id)` e `checkin(token)`. |
| `backend/tests/qrcode.test.js` | Testes unitários do gerador de QR Code, hashing e SVG. |
| `backend/tests/checkin.test.js` | Testes da janela de tolerância de check-in e templates de e-mail. |
| `tests/integracao-fase3-qr.test.cjs` | Testes do cliente HTTP para rotas de QR Code e check-in. |

---

## 3. Regras de Negócio e Segurança

1. **Privacidade e Proteção de Dados:**
   - O token cru do QR Code **nunca é persistido em texto claro** no banco de dados. O MariaDB armazena unicamente o hash SHA-256 (`qr_token_hash`).
   - O endpoint de listagem `GET /api/reservas/minhas` não expõe tokens nem hashes para terceiros.
2. **Janela Temporal de Check-in:**
   - **Início:** O check-in é liberado **15 minutos antes** do horário agendado de início (`inicio_utc`). Tentativas anteriores recebem HTTP 422 com aviso do tempo restante.
   - **Término:** O check-in encerra pontualmente no final da reserva (`fim_utc`).
   - **Tolerância contra no-show:** Se nenhum check-in ocorrer até 10 minutos após o início (`GRACE_SECONDS = 600`), a reserva passa para `expirada` e o horário é liberado.
3. **Prevenção de Fraude:**
   - Reservas canceladas ou expiradas têm o check-in sumariamente rejeitado (HTTP 409).
   - Cada aluno autenticado pode registrar sua presença apenas uma vez por reserva (`uq_presencas_reserva_usuario`).

---

## 4. Como Executar os Testes

### Testes Automatizados

No terminal, na pasta raiz ou em `backend`:

```powershell
# Testes do gerador de QR Code, regras e e-mails
cd backend
node --test tests/qrcode.test.js tests/checkin.test.js tests/regras.test.js tests/ra.test.js tests/estatisticas.test.js

# Testes de integração do frontend
cd ..
node --test tests/integracao-fase2.test.cjs tests/integracao-fase3-qr.test.cjs
```

---

## 5. Roteiro de Teste Manual Passo a Passo

1. **Iniciar Serviços:**
   - No **XAMPP**, inicie **Apache** e **MySQL**.
   - No terminal `backend`:
     ```powershell
     cd C:\xampp\htdocs\CampusFlow\backend
     npm run dev
     ```
2. **Criar Reserva:**
   - Abra o sistema no navegador: `http://localhost/CampusFlow/frontend/index.html` (ou via Live Server).
   - Entre com `aluno_teste` / senha cadastrada.
   - Acesse **Reservar sala**, selecione uma sala (ex: Sala 101), um horário futuro para hoje (ex: daqui a 5 minutos) e informe 10 pessoas.
   - Confirme a reserva.
3. **Verificar E-mail Gerado:**
   - Abra a pasta `backend/outbox/`.
   - Dê dois cliques no arquivo `.html` gerado (ex: `email-reserva-1-...html`).
   - Veja o QR Code renderizado perfeitamente e os detalhes da reserva.
4. **Ver QR Code no Sistema:**
   - Vá para **Minhas Reservas**.
   - Note o botão **▣ Ver QR Code** na reserva confirmada.
   - Clique nele: o modal abrirá com o QR Code, dados da sala e o contador de presenças zerado.
   - Clique em **Copiar link**.
5. **Realizar o Check-in:**
   - Cole o link copiado em uma nova aba (ou escaneie com o celular na mesma rede).
   - A página `pages/checkin.html?token=...` reconhecerá a sua conta e mostrará o botão de validação.
   - Clique em **Validar Minha Presença Agora**.
   - Veja a mensagem de sucesso, o status mudando para **Em uso** e o contador de presentes subindo para **1**.
6. **Validar no Painel Administrativo:**
   - Consulte `/api/admin/estatisticas` com usuário admin: a reserva constará como `em_uso`, elevando a taxa de comparecimento e computando os minutos aproveitados!

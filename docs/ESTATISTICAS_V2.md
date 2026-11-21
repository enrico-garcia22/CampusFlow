# CampusFlow — Estatísticas administrativas v2

**Escopo:** atualização apenas da rota `GET /api/admin/estatisticas` para as cinco salas atuais do banco, sem alterar SQL nem os endpoints usados pelo frontend.

## Indicadores novos

- `resumo_geral`: totais de reservas por estado, taxa de comparecimento, taxa de ausência, aproveitamento planejado, aproveitamento associado a check-ins, minutos com check-in e minutos potencialmente liberados.
- `por_sala`: mantém `sala_id`, `sala_nome`, `total_reservas`, `faltas` e `utilizadas` da versão anterior e acrescenta `capacidade`, `confirmadas`, `em_uso`, `concluidas`, `canceladas` e os indicadores.
- `demanda_por_hora`: 24 faixas (00:00 a 23:00), com totais de reservas não canceladas por hora **local**, usando `America/Sao_Paulo`.
- `horarios_mais_procurados`: cinco maiores faixas de horário, ordenadas por número de reservas.
- `metodologia`: explicações incorporadas à resposta para evitar interpretações incorretas.

## Definições essenciais

- Taxa de comparecimento = (`em_uso` + `concluida`) / (`em_uso` + `concluida` + `expirada`) × 100.
- Taxa de ausência = `expirada` / (`em_uso` + `concluida` + `expirada`) × 100.
- Antes da implantação do QR Code, não haverá presença real confirmada: as duas taxas ficarão `null` se não houver reservas comparáveis ou poderão mostrar só faltas, se houver expiradas.
- Aproveitamento **planejado** = soma de (`qtd_pessoas` × duração em minutos) / soma de (`capacidade` × duração em minutos) × 100, apenas para reservas `confirmada`, `em_uso` e `concluida`.
- Aproveitamento **com check-in** = mesma razão, apenas para reservas `em_uso` ou `concluida` (não prova permanência real).
- Minutos reservados com check-in = duração originalmente agendada das reservas com confirmação; não são minutos de presença contínua medida.
- Minutos potencialmente liberados = `max(0, fim_utc − (inicio_utc + GRACE_SECONDS))`, apenas para reservas `expirada`. Mede potencial de liberação por no-show; não prova uma segunda ocupação real.
- Reservas `cancelada` contam no total histórico e no indicador de cancelamentos, mas não entram nas taxas de comparecimento nem na demanda por hora.
- Sem dados comparáveis, percentuais são `null`, não `0`.

## Como validar no Windows

Com XAMPP (MySQL) ativo e a API em execução:

```powershell
# Na raiz do repositório
cd backend
npm.cmd test
npm.cmd run dev
```

Em segundo terminal, faça login como administrador e use o token real (não compartilhe):

```powershell
$login = @{ nome_usuario='admin_teste'; senha='senhaAdminTeste123' } | ConvertTo-Json
$resposta = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method Post -ContentType 'application/json' -Body $login
$tokenAdmin = $resposta.token
$stats = Invoke-RestMethod -Uri 'http://localhost:3001/api/admin/estatisticas' -Headers @{ Authorization = "Bearer $tokenAdmin" }
$stats.resumo_geral | Format-List
$stats.por_sala | Format-Table sala_nome,total_reservas,confirmadas,canceladas,faltas,utilizadas,taxa_ausencia_percentual,aproveitamento_planejado_percentual
$stats.horarios_mais_procurados | Format-Table
```

Lembrete: no Windows, Ctrl+C para interromper o `npm.cmd run dev` quando necessário. A API usa Node.js e Express, não PHP.

## Observações

As funções estatísticas têm testes unitários. A consulta SQL precisa ser validada contra o MariaDB instalado no computador de desenvolvimento (não foi executada contra um banco local nesta entrega). Não há migração SQL nesta versão.

// Critério do MVP: entre salas disponíveis, escolher a de menor capacidade
// que acomode todos os participantes. Não há modelo de IA nesta versão.
export function ordenarSalasRecomendadas(salas, pessoas) {
  return salas
    .filter((s) => s.disponivel && s.capacidade >= pessoas && s.funciona_no_periodo)
    .sort((a, b) => a.capacidade - b.capacidade || a.id - b.id)
    .map((s, indice) => ({
      ...s,
      posicao: indice + 1,
      percentual_aproveitamento: Math.round((pessoas / s.capacidade) * 100),
      vagas_nao_utilizadas: s.capacidade - pessoas,
      motivo: indice === 0
        ? 'Melhor aproveitamento entre as salas disponíveis'
        : 'Alternativa disponível para o grupo',
    }));
}

import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { Library } from '../hooks/useLibrary';
import {
  activityByDay,
  computeRetention,
  computeStreak,
  dueCount,
  forecast,
  reviewedToday,
  stageBreakdown,
} from '../lib/stats';
import { formatIntervalLabel } from '../lib/sm2';
import { stripMarkdown } from '../components/MarkdownContent';
import { softSpring, spring } from '../components/ui';

const GRADE_META = {
  1: { label: 'Errei', dot: 'bg-again', text: 'text-again' },
  2: { label: 'Difícil', dot: 'bg-hard', text: 'text-hard' },
  3: { label: 'Bom', dot: 'bg-good', text: 'text-good' },
  4: { label: 'Fácil', dot: 'bg-easy', text: 'text-easy' },
} as const;

export function StatsView({ library }: { library: Library }) {
  const { decks, cards, logs } = library;

  const streak = useMemo(() => computeStreak(logs), [logs]);
  const retention = useMemo(() => computeRetention(logs), [logs]);
  const todayCount = useMemo(() => reviewedToday(logs), [logs]);
  const due = useMemo(() => dueCount(cards), [cards]);
  const stages = useMemo(() => stageBreakdown(cards), [cards]);
  const nextDays = useMemo(() => forecast(cards, 7), [cards]);
  const activity = useMemo(() => activityByDay(logs, 84), [logs]); // 12 semanas

  const totalCards = Math.max(1, cards.length);
  const maxForecast = Math.max(4, ...nextDays.map((d) => d.count));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {[
          { label: 'Ofensiva atual', value: `${streak} ${streak === 1 ? 'dia' : 'dias'}`, sub: 'Dias seguidos estudando' },
          {
            label: 'Retenção (30d)',
            value: retention !== null ? `${retention}%` : '—',
            sub: `${logs.length} ${logs.length === 1 ? 'revisão' : 'revisões'}`,
          },
          { label: 'Revisados hoje', value: String(todayCount), sub: `${due} pendentes agora` },
          { label: 'Total de cartões', value: String(cards.length), sub: `Em ${decks.length} ${decks.length === 1 ? 'baralho' : 'baralhos'}` },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...softSpring, delay: idx * 0.04 }}
            className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line sm:p-5"
          >
            <p className="text-xs font-medium text-muted">{item.label}</p>
            <p className="tabular mt-1.5 text-xl font-semibold tracking-tight text-ink sm:mt-2 sm:text-[28px]">
              {item.value}
            </p>
            <p className="mt-1 truncate text-[11px] text-faint sm:text-xs">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Estágios de memória + Previsão 7 dias */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Distribuição SM-2 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...softSpring, delay: 0.1 }}
          className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6"
        >
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Estágios de memória</h2>
              <p className="mt-0.5 text-xs text-muted">Maturidade dos cartões pelo intervalo SM-2</p>
            </div>
            <span className="tabular text-xs text-muted">{cards.length} cartões</span>
          </div>

          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-sunken ring-1 ring-line sm:mt-5">
            <motion.div
              className="bg-ink/25"
              initial={{ width: 0 }}
              animate={{ width: `${(stages.new / totalCards) * 100}%` }}
              transition={softSpring}
            />
            <motion.div
              className="bg-ink/45"
              initial={{ width: 0 }}
              animate={{ width: `${(stages.learning / totalCards) * 100}%` }}
              transition={softSpring}
            />
            <motion.div
              className="bg-ink/70"
              initial={{ width: 0 }}
              animate={{ width: `${(stages.young / totalCards) * 100}%` }}
              transition={softSpring}
            />
            <motion.div
              className="bg-ink"
              initial={{ width: 0 }}
              animate={{ width: `${(stages.mature / totalCards) * 100}%` }}
              transition={softSpring}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {[
              { label: 'Novos', desc: 'Nunca vistos', count: stages.new, swatch: 'bg-ink/25' },
              { label: 'Aprendendo', desc: '< 3 dias', count: stages.learning, swatch: 'bg-ink/45' },
              { label: 'Recentes', desc: '3–20 dias', count: stages.young, swatch: 'bg-ink/70' },
              { label: 'Consolidados', desc: '21+ dias', count: stages.mature, swatch: 'bg-ink' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-sunken p-3 ring-1 ring-line">
                <div className="flex items-center gap-2 text-xs font-medium text-ink-2">
                  <span className={`h-2 w-2 rounded-full ${s.swatch}`} />
                  {s.label}
                </div>
                <p className="tabular mt-1.5 text-lg font-semibold text-ink">{s.count}</p>
                <p className="text-[11px] text-faint">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Previsão de 7 dias */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...softSpring, delay: 0.14 }}
          className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6"
        >
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Próximos 7 dias</h2>
            <p className="mt-0.5 text-xs text-muted">Carga diária de revisões programadas</p>
          </div>

          <div className="mt-5 grid h-36 grid-cols-7 items-end gap-2 pt-4 sm:mt-6 sm:gap-2.5">
            {nextDays.map((day, idx) => {
              const pct = day.count === 0 ? 0 : Math.max(10, Math.round((day.count / maxForecast) * 100));
              const label =
                idx === 0
                  ? 'Hoje'
                  : idx === 1
                  ? 'Amanhã'
                  : day.date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
              return (
                <div key={idx} className="flex h-full flex-col items-center justify-end">
                  <span className="tabular mb-1.5 text-xs font-medium text-ink-2">{day.count}</span>
                  <div className="flex h-24 w-full max-w-[36px] items-end overflow-hidden rounded-lg bg-sunken ring-1 ring-line">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${pct}%` }}
                      transition={{ ...spring, delay: idx * 0.03 }}
                      className={`w-full rounded-t-md ${idx === 0 ? 'bg-ink' : 'bg-ink/45'}`}
                    />
                  </div>
                  <span className="mt-2 truncate max-w-full text-[11px] capitalize text-muted">{label}</span>
                </div>
              );
            })}
          </div>
        </motion.section>
      </div>

      {/* Mapa de constância (12 semanas) */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...softSpring, delay: 0.18 }}
        className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Constância de estudo</h2>
            <p className="mt-0.5 text-xs text-muted">Atividade diária nas últimas 12 semanas</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-faint">
            <span>Menos</span>
            <span className="h-2.5 w-2.5 rounded-[3px] bg-sunken ring-1 ring-line" />
            <span className="h-2.5 w-2.5 rounded-[3px] bg-ink/25" />
            <span className="h-2.5 w-2.5 rounded-[3px] bg-ink/55" />
            <span className="h-2.5 w-2.5 rounded-[3px] bg-ink" />
            <span>Mais</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-14 gap-1 sm:grid-cols-28 sm:gap-1.5">
          {activity.map((item, i) => {
            const tone =
              item.count === 0
                ? 'bg-sunken ring-1 ring-line'
                : item.count < 5
                ? 'bg-ink/25'
                : item.count < 15
                ? 'bg-ink/55'
                : 'bg-ink';
            return (
              <div
                key={i}
                title={`${item.date.toLocaleDateString('pt-BR')}: ${item.count} ${
                  item.count === 1 ? 'revisão' : 'revisões'
                }`}
                className={`aspect-square rounded-[4px] transition-transform hover:scale-110 ${tone}`}
              />
            );
          })}
        </div>
      </motion.section>

      {/* Histórico recente */}
      {logs.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...softSpring, delay: 0.22 }}
          className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line"
        >
          <div className="px-5 py-4 sm:px-6">
            <h2 className="text-[15px] font-semibold tracking-tight">Últimas revisões</h2>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {logs.slice(0, 10).map((log) => {
              const card = cards.find((c) => c.id === log.cardId);
              const deck = decks.find((d) => d.id === log.deckId);
              const g = GRADE_META[log.grade];
              return (
                <li key={log.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:gap-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {card ? stripMarkdown(card.front) : 'Cartão excluído'}
                    </p>
                    <p className="truncate text-xs text-muted">{deck?.title ?? '—'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs sm:flex-row sm:items-center sm:gap-4">
                    <span className={`inline-flex items-center gap-1.5 font-medium ${g.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
                      {g.label}
                    </span>
                    <span className="tabular text-[11px] text-muted sm:text-xs">
                      {formatIntervalLabel(log.intervalBefore)} → {formatIntervalLabel(log.intervalAfter)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}
    </div>
  );
}

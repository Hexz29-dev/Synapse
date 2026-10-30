import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Flashcard, ReviewGrade, ReviewLog } from '../types/flashcard';
import type { Library } from '../hooks/useLibrary';
import { getMemoryStage, LEARN_AHEAD_MS, previewNextIntervals } from '../lib/sm2';
import { formatRelative, plural } from '../lib/format';
import { buildDueQueue, reviewedToday } from '../lib/stats';
import { MarkdownContent } from '../components/MarkdownContent';
import { Button, Kbd, softSpring, spring } from '../components/ui';
import { Icon } from '../components/icons';

const GRADES: { grade: ReviewGrade; label: string; dot: string }[] = [
  { grade: 1, label: 'Errei', dot: 'bg-again' },
  { grade: 2, label: 'Difícil', dot: 'bg-hard' },
  { grade: 3, label: 'Bom', dot: 'bg-good' },
  { grade: 4, label: 'Fácil', dot: 'bg-easy' },
];

const DAILY_LIMIT_OPTIONS = [
  { value: 10, label: '10 novos/dia' },
  { value: 20, label: '20 novos/dia' },
  { value: 30, label: '30 novos/dia' },
  { value: 50, label: '50 novos/dia' },
  { value: 100, label: '100 novos/dia' },
  { value: 9999, label: 'Sem limite' },
] as const;

const STAGE_LABEL = { new: 'Novo', learning: 'Aprendendo', young: 'Recente', mature: 'Consolidado' } as const;

interface StudyViewProps {
  library: Library;
  deckScope: string | null;
  onDeckScopeChange: (id: string | null) => void;
  onCreateDeck: () => void;
  onCreateCard: () => void;
  onEditCard: (card: Flashcard) => void;
}

export function StudyView({
  library,
  deckScope,
  onDeckScopeChange,
  onCreateDeck,
  onCreateCard,
  onEditCard,
}: StudyViewProps) {
  const { decks, cards, logs, dailyNewLimit, setDailyNewLimit, reviewCard } = library;
  const [revealed, setRevealed] = useState(false);
  const [ahead, setAhead] = useState(false);
  const [sessionDone, setSessionDone] = useState<Set<string>>(() => new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Reavalia a fila a cada 30s (cartões de aprendizado voltam após alguns minutos)
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setAhead(false);
    setSessionDone(new Set());
  }, [deckScope]);

  const scoped = useMemo(
    () => (deckScope ? cards.filter((c) => c.deckId === deckScope) : cards),
    [cards, deckScope]
  );

  const scopedLogs = useMemo(
    () => (deckScope ? logs.filter((l) => l.deckId === deckScope) : logs),
    [logs, deckScope]
  );

  const queue = useMemo(() => {
    const referenceNow = new Date(nowMs);
    if (ahead) {
      return [...scoped]
        .filter((c) => !sessionDone.has(c.id))
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    }
    return buildDueQueue(scoped, scopedLogs, {
      dailyNewLimit,
      aheadMs: LEARN_AHEAD_MS,
      now: referenceNow,
    });
  }, [scoped, scopedLogs, ahead, sessionDone, dailyNewLimit, nowMs]);

  const current = queue[0] ?? null;
  const intervals = useMemo(
    () => (current ? previewNextIntervals(current, new Date(nowMs)) : null),
    [current, nowMs]
  );
  const deckOf = (id: string) => decks.find((d) => d.id === id);

  useEffect(() => setRevealed(false), [current?.id]);

  const grade = useCallback(
    (g: ReviewGrade) => {
      if (!current || !revealed) return;
      if (ahead) setSessionDone((prev) => new Set(prev).add(current.id));
      setNowMs(Date.now());
      void reviewCard(current, g);
    },
    [current, revealed, ahead, reviewCard]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (!current) return;
      if ((e.code === 'Space' || e.key === 'Enter') && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key) as ReviewGrade);
      } else if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onEditCard(current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, revealed, grade, onEditCard]);

  const doneToday = reviewedToday(scopedLogs);
  const total = doneToday + queue.length;
  const progress = total === 0 ? 0 : doneToday / total;

  // ----- Estados vazios ----------------------------------------------------
  if (decks.length === 0) {
    return (
      <EmptyState
        title="Comece criando um baralho"
        body="Baralhos agrupam seus cartões por assunto. Depois é só adicionar perguntas e respostas e o Synapse cuida de quando revisar cada uma."
        action={
          <Button icon={<Icon.Add size={18} />} onClick={onCreateDeck}>
            Criar baralho
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <DeckScopeBar
            decks={decks}
            cards={cards}
            logs={logs}
            dailyNewLimit={dailyNewLimit}
            nowMs={nowMs}
            value={deckScope}
            onChange={onDeckScopeChange}
          />
        </div>

        <label className="shrink-0" title="Limite diário de cartões novos">
          <span className="sr-only">Limite diário de cartões novos</span>
          <select
            aria-label="Limite diário de cartões novos"
            value={dailyNewLimit}
            onChange={(e) => setDailyNewLimit(Number(e.target.value))}
            className="h-8 cursor-pointer rounded-full border border-line bg-surface px-3 text-xs font-medium text-muted outline-none transition-colors hover:border-line-strong hover:text-ink focus:border-ink"
          >
            {DAILY_LIMIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {scoped.length === 0 ? (
        <EmptyState
          title="Nenhum cartão aqui ainda"
          body="Adicione o primeiro cartão para começar a revisar."
          action={
            <Button icon={<Icon.Add size={18} />} onClick={onCreateCard}>
              Novo cartão
            </Button>
          }
        />
      ) : !current ? (
        <SessionComplete
          doneToday={doneToday}
          nextDue={
            [...scoped]
              .filter((c) => getMemoryStage(c) !== 'new')
              .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt
          }
          onStudyAhead={() => {
            setSessionDone(new Set());
            setAhead(true);
          }}
          onCreateCard={onCreateCard}
        />
      ) : (
        <>
          {/* Progresso da sessão */}
          <div className="mb-4 mt-4 flex items-center gap-3 sm:mb-5 sm:mt-6 sm:gap-4">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full rounded-full bg-ink"
                initial={false}
                animate={{ width: `${Math.max(progress * 100, 2)}%` }}
                transition={softSpring}
              />
            </div>
            <span className="tabular shrink-0 text-xs sm:text-[13px] text-muted">
              {ahead ? 'Estudo adiantado' : `${queue.length} restantes`}
            </span>
          </div>

          {/* Pilha de cartões */}
          <div className="relative">
            {queue.length > 1 && (
              <div className="pointer-events-none absolute inset-x-4 -bottom-2 h-full rounded-2xl bg-surface/70 ring-1 ring-line sm:inset-x-5" />
            )}
            {queue.length > 2 && (
              <div className="pointer-events-none absolute inset-x-8 -bottom-4 h-full rounded-2xl bg-surface/40 ring-1 ring-line/70 sm:inset-x-10" />
            )}

            <AnimatePresence mode="popLayout" initial={false}>
              <motion.article
                key={current.id}
                layout
                onClick={() => {
                  if (!revealed) setRevealed(true);
                }}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -24, scale: 0.98, transition: { duration: 0.18 } }}
                transition={softSpring}
                className={`relative overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line ${
                  !revealed ? 'cursor-pointer' : ''
                }`}
              >
                <header className="flex items-center justify-between gap-2 px-5 pt-4 text-xs text-muted sm:px-8 sm:pt-5 sm:text-[13px]">
                  <span className="truncate">
                    {deckOf(current.deckId)?.title}
                    <span className="mx-1.5 text-line-strong sm:mx-2">/</span>
                    {STAGE_LABEL[getMemoryStage(current)]}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCard(current);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-ink/[0.06] hover:text-ink"
                  >
                    <Icon.Edit size={14} />
                    <span>Editar</span>
                  </button>
                </header>

                <div className="min-h-[150px] px-5 pb-6 pt-5 sm:min-h-[180px] sm:px-8 sm:pb-8 sm:pt-8">
                  <MarkdownContent
                    content={current.front}
                    className="text-[17px] font-medium tracking-[-0.01em] text-ink sm:text-[21px]"
                  />
                  {current.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-5">
                      {current.tags.map((t) => (
                        <span key={t} className="rounded-md bg-sunken px-2 py-0.5 text-xs text-muted ring-1 ring-line">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {!revealed && (
                    <p className="mt-6 text-xs text-faint sm:hidden">Toque no cartão para ver a resposta</p>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {revealed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={softSpring}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-dashed border-line-strong bg-sunken px-5 py-5 sm:px-8 sm:py-7">
                        <MarkdownContent content={current.back} className="text-[15px] text-ink-2 sm:text-base" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            </AnimatePresence>
          </div>

          {/* Ações */}
          <div className="mt-6 sm:mt-8">
            <AnimatePresence mode="wait" initial={false}>
              {!revealed ? (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col items-center gap-3"
                >
                  <Button size="lg" className="w-full sm:w-auto sm:min-w-[260px]" onClick={() => setRevealed(true)}>
                    <span>Mostrar resposta</span>
                    <Kbd className="ml-1 hidden border-surface/20 bg-surface/10 text-surface/75 shadow-none sm:inline-flex">
                      Espaço
                    </Kbd>
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="grades"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="mb-2.5 text-center text-xs text-muted sm:mb-3 sm:text-[13px]">
                    Quão bem você lembrou?
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {GRADES.map(({ grade: g, label, dot }, i) => (
                      <motion.button
                        key={g}
                        type="button"
                        onClick={() => grade(g)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...spring, delay: i * 0.03 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        className="group flex flex-col items-start rounded-xl bg-surface px-3.5 py-3 text-left ring-1 ring-line transition-shadow hover:shadow-card hover:ring-line-strong sm:px-4"
                      >
                        <span className="flex w-full items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-medium sm:text-[15px]">
                            <span className={`h-2 w-2 rounded-full ${dot}`} />
                            {label}
                          </span>
                          <Kbd className="hidden sm:inline-flex">{g}</Kbd>
                        </span>
                        <span className="tabular mt-1 pl-4 text-xs text-muted sm:pl-0 sm:text-[13px]">
                          {intervals?.[g]}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-8 hidden items-center justify-center gap-1.5 text-xs text-faint sm:flex">
            <Icon.Keyboard size={14} /> Espaço revela · 1–4 avalia · E edita
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function DeckScopeBar({
  decks,
  cards,
  logs,
  dailyNewLimit,
  nowMs,
  value,
  onChange,
}: {
  decks: Library['decks'];
  cards: Flashcard[];
  logs: ReviewLog[];
  dailyNewLimit: number;
  nowMs: number;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const referenceNow = new Date(nowMs);
  const due = (deckId: string | null) => {
    const deckCards = deckId ? cards.filter((c) => c.deckId === deckId) : cards;
    const deckLogs = deckId ? logs.filter((l) => l.deckId === deckId) : logs;
    return buildDueQueue(deckCards, deckLogs, {
      dailyNewLimit,
      aheadMs: LEARN_AHEAD_MS,
      now: referenceNow,
    }).length;
  };

  const items = [{ id: null as string | null, title: 'Todos' }, ...decks.map((d) => ({ id: d.id, title: d.title }))];

  return (
    <div className="scrollbar-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {items.map((item) => {
        const active = value === item.id;
        const n = due(item.id);
        return (
          <button
            key={item.id ?? 'all'}
            type="button"
            onClick={() => onChange(item.id)}
            className={`relative inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors ${
              active ? 'text-surface' : 'text-ink-2 hover:bg-ink/[0.06]'
            }`}
          >
            {active && (
              <motion.span layoutId="deck-scope" className="absolute inset-0 -z-0 rounded-full bg-ink" transition={spring} />
            )}
            <span className="relative max-w-[160px] truncate sm:max-w-[180px]">{item.title}</span>
            {n > 0 && (
              <span className={`tabular relative text-xs ${active ? 'text-surface/70' : 'text-faint'}`}>{n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SessionComplete({
  doneToday,
  nextDue,
  onStudyAhead,
  onCreateCard,
}: {
  doneToday: number;
  nextDue?: string;
  onStudyAhead: () => void;
  onCreateCard: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={softSpring}
      className="mt-6 rounded-2xl bg-surface px-5 py-10 text-center ring-1 ring-line sm:mt-10 sm:px-12 sm:py-14"
    >
      <motion.div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink text-surface sm:h-14 sm:w-14"
        initial={{ scale: 0.5, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...spring, delay: 0.1 }}
      >
        <Icon.Check size={24} />
      </motion.div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight sm:mt-6 sm:text-2xl">Tudo revisado por agora</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted sm:text-[15px]">
        {doneToday > 0 ? `Você revisou ${plural(doneToday, 'cartão', 'cartões')} hoje. ` : ''}
        {nextDue ? `O próximo volta ${formatRelative(nextDue)}.` : ''}
      </p>
      <div className="mt-7 flex flex-col justify-center gap-2 sm:mt-8 sm:flex-row">
        <Button variant="secondary" icon={<Icon.Refresh size={17} />} onClick={onStudyAhead} className="w-full sm:w-auto">
          Estudar adiantado
        </Button>
        <Button variant="secondary" icon={<Icon.Add size={17} />} onClick={onCreateCard} className="w-full sm:w-auto">
          Novo cartão
        </Button>
      </div>
    </motion.div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={softSpring}
      className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center sm:mt-10 sm:px-8 sm:py-14"
    >
      <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-[15px]">{body}</p>
      {action && <div className="mt-6 flex justify-center sm:mt-7">{action}</div>}
    </motion.div>
  );
}

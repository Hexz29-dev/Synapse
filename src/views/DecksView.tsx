import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Deck, Flashcard } from '../types/flashcard';
import type { Library } from '../hooks/useLibrary';
import { getMemoryStage } from '../lib/sm2';
import { formatRelative, plural } from '../lib/format';
import { dueCount } from '../lib/stats';
import { stripMarkdown } from '../components/MarkdownContent';
import { Button, ConfirmDialog, IconButton, softSpring, spring } from '../components/ui';
import { Icon } from '../components/icons';
import { EmptyState } from './StudyView';

const STAGE = {
  new: { label: 'Novo', cls: 'bg-sunken text-muted ring-line' },
  learning: { label: 'Aprendendo', cls: 'bg-hard/10 text-hard ring-hard/25' },
  young: { label: 'Recente', cls: 'bg-good/10 text-good ring-good/25' },
  mature: { label: 'Consolidado', cls: 'bg-easy/10 text-easy ring-easy/25' },
} as const;

interface DecksViewProps {
  library: Library;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateDeck: () => void;
  onEditDeck: (deck: Deck) => void;
  onCreateCard: (deckId: string) => void;
  onEditCard: (card: Flashcard) => void;
  onStudyDeck: (deckId: string) => void;
}

export function DecksView({
  library,
  selectedId,
  onSelect,
  onCreateDeck,
  onEditDeck,
  onCreateCard,
  onEditCard,
  onStudyDeck,
}: DecksViewProps) {
  const { decks, cards, logs, dailyNewLimit, deleteDeck, deleteCard } = library;
  const [query, setQuery] = useState('');
  const [confirmDeck, setConfirmDeck] = useState<Deck | null>(null);
  const [confirmCard, setConfirmCard] = useState<Flashcard | null>(null);

  // No mobile, selectedId === null mostra a lista de baralhos.
  // No desktop (lg:), se nenhum estiver selecionado, exibe o primeiro baralho automaticamente.
  const explicitSelected = decks.find((d) => d.id === selectedId) ?? null;
  const activeDeck = explicitSelected ?? decks[0] ?? null;

  const statsFor = (deckId: string) => {
    const list = cards.filter((c) => c.deckId === deckId);
    const deckLogs = logs.filter((l) => l.deckId === deckId);
    return {
      total: list.length,
      due: dueCount(list, new Date(), { logs: deckLogs, dailyNewLimit }),
    };
  };

  const deckCards = useMemo(() => {
    if (!activeDeck) return [];
    const q = query.trim().toLowerCase();
    return cards
      .filter((c) => c.deckId === activeDeck.id)
      .filter(
        (c) =>
          !q ||
          c.front.toLowerCase().includes(q) ||
          c.back.toLowerCase().includes(q) ||
          c.tags.some((t) => t.includes(q))
      );
  }, [cards, activeDeck, query]);

  if (decks.length === 0) {
    return (
      <EmptyState
        title="Nenhum baralho ainda"
        body="Crie um baralho para cada assunto que você quer memorizar."
        action={
          <Button icon={<Icon.Add size={18} />} onClick={onCreateDeck}>
            Criar baralho
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
      {/* Lista de baralhos (visível no mobile quando nenhum baralho foi aberto; sempre visível no desktop) */}
      <aside className={explicitSelected ? 'hidden lg:block' : ''}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-muted">{plural(decks.length, 'baralho', 'baralhos')}</h2>
          <Button size="sm" variant="secondary" icon={<Icon.Add size={16} />} onClick={onCreateDeck}>
            Novo baralho
          </Button>
        </div>

        {/* Lista de cartões de baralho para mobile + sidebar para desktop */}
        <nav className="space-y-2 lg:space-y-1">
          {decks.map((deck) => {
            const s = statsFor(deck.id);
            const active = deck.id === activeDeck?.id;
            return (
              <button
                key={deck.id}
                type="button"
                onClick={() => onSelect(deck.id)}
                className={`relative flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left ring-1 ring-line transition-colors lg:rounded-xl lg:bg-transparent lg:px-3.5 lg:py-3 lg:ring-0 ${
                  active ? '' : 'hover:bg-ink/[0.04]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="deck-active"
                    className="hidden lg:block absolute inset-0 rounded-xl bg-surface shadow-card ring-1 ring-line"
                    transition={spring}
                  />
                )}
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{deck.title}</span>
                  {deck.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted lg:hidden">{deck.description}</span>
                  )}
                  <span className="tabular mt-0.5 block text-xs text-muted lg:text-[13px]">
                    {plural(s.total, 'cartão', 'cartões')}
                  </span>
                </span>
                <span className="relative flex items-center gap-2">
                  {s.due > 0 && (
                    <span className="tabular rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-surface">
                      {s.due}
                    </span>
                  )}
                  <Icon.ArrowRight size={16} className="text-faint lg:hidden" />
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Detalhe do baralho */}
      <section className={explicitSelected ? '' : 'hidden lg:block'}>
        <AnimatePresence mode="wait">
          {activeDeck ? (
            <motion.div
              key={activeDeck.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-[13px] font-medium text-muted hover:text-ink lg:hidden"
              >
                <Icon.ArrowLeft size={16} /> Todos os baralhos
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[26px]">
                    {activeDeck.title}
                  </h1>
                  {activeDeck.description && (
                    <p className="mt-1 max-w-[60ch] text-sm text-muted sm:text-[15px]">{activeDeck.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={statsFor(activeDeck.id).total === 0}
                    onClick={() => onStudyDeck(activeDeck.id)}
                    className="flex-1 sm:flex-initial"
                  >
                    Estudar
                  </Button>
                  <Button
                    size="sm"
                    icon={<Icon.Add size={16} />}
                    onClick={() => onCreateCard(activeDeck.id)}
                    className="flex-1 sm:flex-initial"
                  >
                    Cartão
                  </Button>
                  <IconButton label="Editar baralho" onClick={() => onEditDeck(activeDeck)}>
                    <Icon.Edit size={17} />
                  </IconButton>
                  <IconButton
                    label="Excluir baralho"
                    onClick={() => setConfirmDeck(activeDeck)}
                    className="hover:text-[#b42318]"
                  >
                    <Icon.Trash size={17} />
                  </IconButton>
                </div>
              </div>

              {statsFor(activeDeck.id).total > 0 && (
                <div className="group relative mt-5 sm:mt-7">
                  <Icon.Search
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint group-focus-within:text-ink"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar nos cartões"
                    aria-label="Buscar nos cartões"
                    className="h-11 w-full rounded-[10px] border border-line bg-surface pl-10 pr-3.5 text-base outline-none transition-[border-color,box-shadow] hover:border-line-strong focus:border-ink focus:shadow-[0_0_0_4px_rgb(22_22_22/0.06)] sm:h-10 sm:text-sm"
                  />
                </div>
              )}

              {statsFor(activeDeck.id).total === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center sm:mt-8 sm:py-12">
                  <p className="text-[15px] font-medium">Este baralho está vazio</p>
                  <p className="mt-1 text-sm text-muted">Adicione cartões para começar a revisar.</p>
                  <Button className="mt-5" icon={<Icon.Add size={17} />} onClick={() => onCreateCard(activeDeck.id)}>
                    Novo cartão
                  </Button>
                </div>
              ) : deckCards.length === 0 ? (
                <p className="mt-10 text-center text-sm text-muted">Nenhum cartão corresponde a “{query}”.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
                  <AnimatePresence initial={false}>
                    {deckCards.map((card) => {
                      const stage = STAGE[getMemoryStage(card)];
                      return (
                        <motion.li
                          key={card.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={softSpring}
                          className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-sunken sm:items-center sm:gap-4 sm:px-5"
                        >
                          <button type="button" onClick={() => onEditCard(card)} className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-[15px] font-medium sm:font-normal">
                              {stripMarkdown(card.front)}
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-muted">
                              {stripMarkdown(card.back)}
                            </span>
                            {/* Metadados visíveis no mobile */}
                            <span className="mt-2 flex items-center gap-2 sm:hidden">
                              <span className={`rounded-md px-2 py-0.5 text-[11px] ring-1 ${stage.cls}`}>
                                {stage.label}
                              </span>
                              <span className="tabular text-xs text-muted">{formatRelative(card.dueAt)}</span>
                            </span>
                          </button>
                          <span className={`hidden shrink-0 rounded-md px-2 py-0.5 text-xs ring-1 sm:inline ${stage.cls}`}>
                            {stage.label}
                          </span>
                          <span className="tabular hidden w-20 shrink-0 text-right text-[13px] text-muted md:inline">
                            {formatRelative(card.dueAt)}
                          </span>
                          <IconButton
                            label="Excluir cartão"
                            onClick={() => setConfirmCard(card)}
                            className="shrink-0 opacity-100 hover:text-[#b42318] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          >
                            <Icon.Trash size={16} />
                          </IconButton>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <ConfirmDialog
        open={!!confirmDeck}
        title="Excluir baralho?"
        description={
          confirmDeck
            ? `“${confirmDeck.title}” e ${plural(statsFor(confirmDeck.id).total, 'cartão', 'cartões')} serão apagados permanentemente, junto com o histórico de revisões.`
            : ''
        }
        confirmLabel="Excluir baralho"
        onClose={() => setConfirmDeck(null)}
        onConfirm={async () => {
          if (!confirmDeck) return;
          const ok = await deleteDeck(confirmDeck.id);
          if (ok) onSelect(null);
        }}
      />
      <ConfirmDialog
        open={!!confirmCard}
        title="Excluir cartão?"
        description="O cartão e seu histórico de revisões serão apagados permanentemente."
        confirmLabel="Excluir cartão"
        onClose={() => setConfirmCard(null)}
        onConfirm={async () => {
          if (confirmCard) await deleteCard(confirmCard.id);
        }}
      />
    </div>
  );
}

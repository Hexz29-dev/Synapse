import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Session } from '@supabase/supabase-js';
import type { Deck, Flashcard } from './types/flashcard';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { computeStreak, dueCount } from './lib/stats';
import { useAuth } from './hooks/useAuth';
import { useLibrary } from './hooks/useLibrary';
import { useTheme } from './hooks/useTheme';
import { AuthScreen, UpdatePasswordScreen } from './components/auth/AuthScreen';
import { CardEditor, DeckEditor } from './components/Editors';
import { MarkdownContent } from './components/MarkdownContent';
import { Button, IconButton, Logo, Spinner, ToastProvider, softSpring, spring, useToast } from './components/ui';
import { Icon } from './components/icons';
import { StudyView } from './views/StudyView';
import { DecksView } from './views/DecksView';
import { StatsView } from './views/StatsView';
import { schemaSql } from './lib/schemaSql';

type Tab = 'study' | 'decks' | 'stats';

export function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}

function Root() {
  const auth = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas p-6">
        <div className="max-w-md rounded-2xl bg-surface p-7 shadow-card ring-1 ring-line">
          <Logo size={28} />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Configure o Supabase</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Defina <code className="font-mono text-xs text-ink">VITE_SUPABASE_URL</code> e{' '}
            <code className="font-mono text-xs text-ink">VITE_SUPABASE_PUBLISHABLE_KEY</code> no arquivo{' '}
            <code className="font-mono text-xs text-ink">.env</code> e reinicie o servidor.
          </p>
        </div>
      </div>
    );
  }

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas text-ink">
        <Spinner />
      </div>
    );
  }

  if (auth.status === 'signed-out') {
    return <AuthScreen />;
  }

  if (auth.status === 'recovery') {
    return <UpdatePasswordScreen />;
  }

  return <Workspace session={auth.session} />;
}

function Workspace({ session }: { session: Session }) {
  const toast = useToast();
  const { isDark, toggleTheme } = useTheme();
  const library = useLibrary(session.user.id, (msg) => toast('error', msg));

  const [tab, setTab] = useState<Tab>('study');
  const [deckScope, setDeckScope] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const [deckModal, setDeckModal] = useState<{ open: boolean; deck: Deck | null }>({ open: false, deck: null });
  const [cardModal, setCardModal] = useState<{
    open: boolean;
    card: Flashcard | null;
    defaultDeckId: string | null;
  }>({ open: false, card: null, defaultDeckId: null });

  const due = dueCount(library.cards);
  const streak = computeStreak(library.logs);

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
  };

  const openNewCard = (preferredDeckId?: string | null) => {
    if (library.decks.length === 0) {
      setDeckModal({ open: true, deck: null });
      return;
    }
    setCardModal({
      open: true,
      card: null,
      defaultDeckId: preferredDeckId ?? deckScope ?? selectedDeckId ?? library.decks[0]?.id ?? null,
    });
  };

  const navItems = [
    { id: 'study' as const, label: 'Estudar', icon: Icon.Study, badge: due > 0 ? String(due) : undefined },
    { id: 'decks' as const, label: 'Baralhos', icon: Icon.Decks, badge: undefined },
    { id: 'stats' as const, label: 'Progresso', icon: Icon.Stats, badge: undefined },
  ];

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink">
      {/* Navegação superior */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setTab('study')}
              className="flex items-center gap-2 text-left"
            >
              <Logo size={25} />
              <span className="text-[15px] font-semibold tracking-tight">Synapse</span>
            </button>

            {/* Navegação por abas visível no tablet/desktop */}
            <nav
              className="relative hidden items-center rounded-xl bg-sunken p-1 ring-1 ring-line sm:flex"
              aria-label="Principal"
            >
              {navItems.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`relative z-10 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                      active ? 'text-ink' : 'text-muted hover:text-ink-2'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="top-nav-tab"
                        className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                        transition={spring}
                      />
                    )}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="tabular rounded-full bg-ink px-1.5 py-px text-[11px] font-medium text-surface">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {streak > 0 && (
              <div
                title={`Ofensiva de ${streak} ${streak === 1 ? 'dia' : 'dias'}`}
                className="inline-flex items-center gap-1 rounded-lg bg-sunken px-2 py-1 text-xs font-medium text-ink-2 ring-1 ring-line sm:px-2.5 sm:py-1.5"
              >
                <Icon.Streak size={13} />
                <span className="tabular">{streak}d</span>
              </div>
            )}

            <Button size="sm" icon={<Icon.Add size={16} />} onClick={() => openNewCard()}>
              <span className="hidden sm:inline">Novo cartão</span>
              <span className="sm:hidden">Cartão</span>
            </Button>

            <span className="hidden max-w-[160px] truncate pl-1 text-xs text-muted md:inline">
              {session.user.email}
            </span>

            <IconButton
              label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              onClick={toggleTheme}
            >
              {isDark ? <Icon.Sun size={17} /> : <Icon.Moon size={17} />}
            </IconButton>

            <IconButton label="Sair da conta" onClick={handleSignOut}>
              <Icon.Logout size={17} />
            </IconButton>
          </div>
        </div>
      </header>

      {/* Conteúdo principal (com espaço inferior para a barra de abas no mobile) */}
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6 sm:py-10">
        {library.status === 'loading' ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Spinner />
          </div>
        ) : library.status === 'schema-missing' ? (
          <SchemaSetupView onRetry={library.reload} />
        ) : library.status === 'error' ? (
          <div className="mx-auto max-w-md rounded-2xl bg-surface p-7 text-center shadow-card ring-1 ring-line">
            <h2 className="text-lg font-semibold tracking-tight">Não foi possível carregar seus dados</h2>
            <p className="mt-1.5 text-sm text-muted">{library.errorMessage}</p>
            <Button className="mt-5" onClick={library.reload}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={softSpring}
            >
              {tab === 'study' && (
                <StudyView
                  library={library}
                  deckScope={deckScope}
                  onDeckScopeChange={setDeckScope}
                  onCreateDeck={() => setDeckModal({ open: true, deck: null })}
                  onCreateCard={() => openNewCard(deckScope)}
                  onEditCard={(card) => setCardModal({ open: true, card, defaultDeckId: card.deckId })}
                />
              )}

              {tab === 'decks' && (
                <DecksView
                  library={library}
                  selectedId={selectedDeckId}
                  onSelect={setSelectedDeckId}
                  onCreateDeck={() => setDeckModal({ open: true, deck: null })}
                  onEditDeck={(deck) => setDeckModal({ open: true, deck })}
                  onCreateCard={(deckId) => openNewCard(deckId)}
                  onEditCard={(card) => setCardModal({ open: true, card, defaultDeckId: card.deckId })}
                  onStudyDeck={(deckId) => {
                    setDeckScope(deckId);
                    setTab('study');
                  }}
                />
              )}

              {tab === 'stats' && <StatsView library={library} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Barra de navegação inferior para mobile (zona do polegar) */}
      <nav
        aria-label="Navegação móvel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md sm:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
          {navItems.map((item) => {
            const active = tab === item.id;
            const ItemIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-ink' : 'text-muted'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-bottom-nav"
                    className="absolute inset-0 -z-10 rounded-xl bg-sunken ring-1 ring-line"
                    transition={spring}
                  />
                )}
                <span className="relative inline-flex">
                  <ItemIcon size={19} />
                  {item.badge && (
                    <span className="tabular absolute -right-3 -top-1 rounded-full bg-ink px-1 text-[10px] leading-4 font-semibold text-surface">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modais de criação/edição */}
      <DeckEditor
        open={deckModal.open}
        deck={deckModal.deck}
        onClose={() => setDeckModal({ open: false, deck: null })}
        onSubmit={async (input) => {
          if (deckModal.deck) {
            const ok = await library.updateDeck(deckModal.deck.id, input);
            if (ok) toast('success', 'Baralho atualizado');
            return ok;
          }
          const created = await library.createDeck(input);
          if (created) {
            setSelectedDeckId(created.id);
            setDeckScope(created.id);
            toast('success', 'Baralho criado');
            return true;
          }
          return false;
        }}
      />

      <CardEditor
        open={cardModal.open}
        card={cardModal.card}
        decks={library.decks}
        defaultDeckId={cardModal.defaultDeckId}
        onClose={() => setCardModal({ open: false, card: null, defaultDeckId: null })}
        onSubmit={async (input, keepOpen) => {
          if (cardModal.card) {
            const ok = await library.updateCard(cardModal.card.id, input);
            if (ok) toast('success', 'Cartão salvo');
            return ok;
          }
          const ok = await library.createCard(input);
          if (ok) toast('success', keepOpen ? 'Cartão criado — adicione o próximo' : 'Cartão criado');
          return ok;
        }}
      />
    </div>
  );
}

/** Caso as tabelas ainda não tenham sido criadas no projeto Supabase, mostra o SQL pronto para copiar. */
function SchemaSetupView({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-7">
      <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Finalize o banco de dados no Supabase</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        As tabelas <code className="font-mono text-xs text-ink">decks</code>,{' '}
        <code className="font-mono text-xs text-ink">cards</code> e{' '}
        <code className="font-mono text-xs text-ink">review_logs</code> ainda não existem neste projeto. Copie o SQL
        abaixo, execute uma vez no <strong>SQL Editor</strong> do seu painel Supabase e clique em{' '}
        <strong>Verificar tabelas</strong>.
      </p>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-xl sm:max-h-80">
        <MarkdownContent content={`\`\`\`sql\n${schemaSql.trim()}\n\`\`\``} />
      </div>

      <div className="mt-5 flex justify-end">
        <Button icon={<Icon.Refresh size={16} />} onClick={onRetry} className="w-full sm:w-auto">
          Verificar tabelas
        </Button>
      </div>
    </div>
  );
}

export default App;

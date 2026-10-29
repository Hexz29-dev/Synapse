import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Deck, Flashcard } from '../types/flashcard';
import type { CardInput } from '../lib/supabase';
import { Button, Field, Modal, TextArea, spring } from './ui';
import { MarkdownContent } from './MarkdownContent';

// ---------------------------------------------------------------------------
// Baralho
// ---------------------------------------------------------------------------
export function DeckEditor({
  open,
  deck,
  onClose,
  onSubmit,
}: {
  open: boolean;
  deck: Deck | null;
  onClose: () => void;
  onSubmit: (input: { title: string; description: string }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(deck?.title ?? '');
      setDescription(deck?.description ?? '');
    }
  }, [open, deck]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const ok = await onSubmit({ title: title.trim(), description: description.trim() });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={deck ? 'Editar baralho' : 'Novo baralho'}
      description={deck ? undefined : 'Agrupe cartões por assunto, matéria ou projeto.'}
      width="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Nome"
          required
          autoFocus
          maxLength={120}
          placeholder="Ex.: Anatomia, Inglês, Algoritmos"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Field
          label="Descrição (opcional)"
          maxLength={500}
          placeholder="Do que se trata este baralho?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" loading={busy} disabled={!title.trim()} className="w-full sm:w-auto">
            {deck ? 'Salvar' : 'Criar baralho'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cartão
// ---------------------------------------------------------------------------
export function CardEditor({
  open,
  card,
  decks,
  defaultDeckId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  card: Flashcard | null;
  decks: Deck[];
  defaultDeckId: string | null;
  onClose: () => void;
  onSubmit: (input: CardInput, keepOpen: boolean) => Promise<boolean>;
}) {
  const [deckId, setDeckId] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDeckId(card?.deckId ?? defaultDeckId ?? decks[0]?.id ?? '');
    setFront(card?.front ?? '');
    setBack(card?.back ?? '');
    setTags(card?.tags.join(', ') ?? '');
    setTab('write');
  }, [open, card, defaultDeckId, decks]);

  const valid = deckId && front.trim() && back.trim();

  const submit = async (keepOpen: boolean) => {
    if (!valid) return;
    setBusy(true);
    const ok = await onSubmit(
      {
        deckId,
        front: front.trim(),
        back: back.trim(),
        tags: tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      },
      keepOpen
    );
    setBusy(false);
    if (ok && keepOpen) {
      setFront('');
      setBack('');
      setTab('write');
    } else if (ok) {
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={card ? 'Editar cartão' : 'Novo cartão'} width="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            submit(!card);
          }
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <div>
            <label htmlFor="card-deck" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Baralho
            </label>
            <select
              id="card-deck"
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="h-11 w-full appearance-none rounded-[10px] border border-line bg-surface px-3.5 text-base outline-none transition-colors hover:border-line-strong focus:border-ink sm:text-[15px]"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Tags"
            placeholder="separadas, por, vírgula"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="relative inline-flex rounded-lg bg-sunken p-0.5 ring-1 ring-line">
            {(['write', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative z-10 h-7 rounded-md px-3 text-[13px] font-medium transition-colors ${
                  tab === t ? 'text-ink' : 'text-muted hover:text-ink-2'
                }`}
              >
                {tab === t && (
                  <motion.span
                    layoutId="card-editor-tab"
                    className="absolute inset-0 -z-10 rounded-md bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    transition={spring}
                  />
                )}
                {t === 'write' ? 'Escrever' : 'Pré-visualizar'}
              </button>
            ))}
          </div>
          <span className="hidden text-xs text-faint sm:block">Markdown: **negrito**, `código`, ```blocos```</span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {tab === 'write' ? (
            <motion.div
              key="write"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-4"
            >
              <TextArea
                label="Frente"
                required
                autoFocus
                rows={3}
                placeholder="A pergunta ou o conceito que você quer lembrar"
                value={front}
                onChange={(e) => setFront(e.target.value)}
              />
              <TextArea
                label="Verso"
                required
                rows={5}
                placeholder="A resposta. Pode incluir listas e blocos de código."
                value={back}
                onChange={(e) => setBack(e.target.value)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="overflow-hidden rounded-xl border border-line"
            >
              <div className="p-4 sm:p-5">
                <p className="mb-2 text-xs font-medium text-faint">Frente</p>
                {front.trim() ? <MarkdownContent content={front} className="text-[17px] font-medium" /> : <Empty />}
              </div>
              <div className="border-t border-dashed border-line bg-sunken p-4 sm:p-5">
                <p className="mb-2 text-xs font-medium text-faint">Verso</p>
                {back.trim() ? <MarkdownContent content={back} className="text-[15px] text-ink-2" /> : <Empty />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="hidden text-xs text-faint sm:block">
            {card ? 'Ctrl + Enter para salvar' : 'Ctrl + Enter salva e abre outro'}
          </span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
              Cancelar
            </Button>
            {!card && (
              <Button variant="secondary" disabled={!valid} onClick={() => submit(true)} className="w-full sm:w-auto">
                Salvar e criar outro
              </Button>
            )}
            <Button type="submit" loading={busy} disabled={!valid} className="w-full sm:w-auto">
              {card ? 'Salvar' : 'Criar cartão'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Empty() {
  return <p className="text-sm italic text-faint">Vazio</p>;
}

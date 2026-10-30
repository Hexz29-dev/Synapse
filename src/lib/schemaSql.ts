/**
 * Esquema SQL do Supabase embutido como string.
 * Permite que a tela de configuração exiba o SQL sem depender de resolução
 * de arquivos externos via bundler no deploy da Vercel.
 */
export const schemaSql = `-- ============================================================================
-- SYNAPSE — Esquema PostgreSQL + Row Level Security (RLS) para Supabase
-- Rode este script uma vez no SQL Editor do seu projeto Supabase.
-- Pode ser executado novamente com segurança (idempotente).
-- ============================================================================

-- 1. Baralhos -----------------------------------------------------------------
create table if not exists public.decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  created_at  timestamptz not null default now(),
  -- Permite FK composta (deck_id, user_id) a partir de cards/review_logs
  unique (id, user_id)
);

-- 2. Cartões (com estado do algoritmo SM-2) -----------------------------------
create table if not exists public.cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id          uuid not null,
  front            text not null check (char_length(front) between 1 and 10000),
  back             text not null check (char_length(back) between 1 and 20000),
  tags             text[] not null default '{}',
  repetition       integer not null default 0 check (repetition >= 0),
  interval_days    numeric(10, 4) not null default 0 check (interval_days >= 0),
  ease_factor      numeric(4, 2) not null default 2.50 check (ease_factor >= 1.30),
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  lapses           integer not null default 0 check (lapses >= 0),
  created_at       timestamptz not null default now(),
  unique (id, user_id),
  -- Garante que o cartão pertence a um baralho do MESMO usuário
  foreign key (deck_id, user_id) references public.decks (id, user_id) on delete cascade
);

-- 3. Histórico de revisões (estatísticas e ofensiva) --------------------------
create table if not exists public.review_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id         uuid not null,
  deck_id         uuid not null,
  grade           smallint not null check (grade between 1 and 4),
  interval_before numeric(10, 4) not null,
  interval_after  numeric(10, 4) not null,
  ease_after      numeric(4, 2) not null,
  reviewed_at     timestamptz not null default now(),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade,
  foreign key (deck_id, user_id) references public.decks (id, user_id) on delete cascade
);

-- Índices (colunas de RLS, FKs e fila de estudo) ------------------------------
create index if not exists decks_user_id_idx            on public.decks (user_id);
create index if not exists cards_user_due_idx           on public.cards (user_id, due_at);
create index if not exists cards_deck_user_idx          on public.cards (deck_id, user_id);
create index if not exists review_logs_user_date_idx    on public.review_logs (user_id, reviewed_at desc);
create index if not exists review_logs_card_user_idx    on public.review_logs (card_id, user_id);
create index if not exists review_logs_deck_user_idx    on public.review_logs (deck_id, user_id);

-- ============================================================================
-- Privilégios: apenas usuários autenticados acessam as tabelas
-- ============================================================================
revoke all on public.decks, public.cards, public.review_logs from anon;
grant select, insert, update, delete on public.decks, public.cards to authenticated;
grant select, insert, delete on public.review_logs to authenticated;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.decks       enable row level security;
alter table public.cards       enable row level security;
alter table public.review_logs enable row level security;

-- decks
drop policy if exists "decks_select_own" on public.decks;
drop policy if exists "decks_insert_own" on public.decks;
drop policy if exists "decks_update_own" on public.decks;
drop policy if exists "decks_delete_own" on public.decks;

create policy "decks_select_own" on public.decks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "decks_insert_own" on public.decks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "decks_update_own" on public.decks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "decks_delete_own" on public.decks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- cards
drop policy if exists "cards_select_own" on public.cards;
drop policy if exists "cards_insert_own" on public.cards;
drop policy if exists "cards_update_own" on public.cards;
drop policy if exists "cards_delete_own" on public.cards;

create policy "cards_select_own" on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "cards_insert_own" on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "cards_update_own" on public.cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cards_delete_own" on public.cards for delete to authenticated
  using ((select auth.uid()) = user_id);

-- review_logs (somente leitura/inserção — o histórico não é editável)
drop policy if exists "review_logs_select_own" on public.review_logs;
drop policy if exists "review_logs_insert_own" on public.review_logs;
drop policy if exists "review_logs_delete_own" on public.review_logs;

create policy "review_logs_select_own" on public.review_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "review_logs_insert_own" on public.review_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "review_logs_delete_own" on public.review_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Atualiza o cache de schema da API REST
notify pgrst, 'reload schema';
`;


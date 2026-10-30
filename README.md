# Synapse

<p align="center">
  <strong>Estúdio minimalista de estudo por repetição espaçada (SM-2) com Markdown e sincronização em nuvem.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-black?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-black?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-black?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-black?style=flat-square&logo=tailwindcss" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-black?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/License-MIT-black?style=flat-square" alt="MIT License" />
</p>

---

## ✦ Visão Geral

O **Synapse** é um aplicativo de repetição espaçada (*Spaced Repetition System — SRS*) de código aberto, focado em alta densidade de aprendizado, memorização de longo prazo e zero distrações.

Inspirado nos conceitos originais do algoritmo **SuperMemo-2 (SM-2)** e na estética refinada de interfaces monocromáticas de ferramentas como Linear e Vercel, o Synapse foi desenvolvido para quem estuda programação, idiomas, concursos, medicina ou arquitetura de software e precisa de uma ferramenta rápida, moderna e funcional em qualquer dispositivo.

---

## ✦ Principais Funcionalidades

* 🧠 **Algoritmo SM-2 Autêntico**:
  * Recalibra o número de repetições, o intervalo em dias e o fator de facilidade (`EF`, com piso em `1.30`) para 4 níveis de recordação:
    * `1` — **Errei** (reagenda para ~10 minutos e penaliza o `EF` em `-0.20`)
    * `2` — **Difícil** (avanço conservador `×1.2`, penaliza o `EF` em `-0.15`)
    * `3` — **Bom** (progressão padrão SM-2: `1d → 4d → I × EF`, mantém o `EF`)
    * `4` — **Fácil** (bônus acelerado `I × EF × 1.3`, bonifica o `EF` em `+0.15`)
  * **Previsão de Intervalo Instantânea**: Cada botão exibe em tempo real o próximo intervalo agendado antes de você responder.

* ✍️ **Suporte a Markdown & Blocos de Código**:
  * Formatação rica com títulos, listas, citações, código em linha e blocos de código com destaque visual e botão de cópia com um clique.

* ⌨️ **Atalhos de Teclado no Desktop**:
  * `Espaço` ou `Enter`: Revelar resposta.
  * `1`, `2`, `3`, `4`: Avaliar o cartão instantaneamente.
  * `E`: Abrir o editor do cartão atual.
  * `Ctrl/Cmd + Enter`: Salvar cartão no editor.

* 📱 **Layout Mobile Refinado**:
  * **Barra de navegação inferior** na zona de alcance do polegar com contador de pendências.
  * **Toque no cartão para virar** (além do botão dedicado).
  * Modais em formato de **Bottom Sheet** com puxador visual.
  * Fontes ajustadas para evitar auto-zoom indesejado em navegadores iOS e Android.

* 🌓 **Modo Escuro Neutro (Dark Mode)**:
  * Paleta monocromática com tons puros de carvão (`#0f0f0f` / `#181818`), sem cores saturadas desnecessárias.
  * Alternância via botão no cabeçalho com persistência em `localStorage` e script anti-FOUC (sem flash de tela branca ao recarregar).

* 📊 **Dashboard de Métricas & Retenção**:
  * **Estágios de Memória (Caixas SM-2)**: Distribuição entre *Novos*, *Aprendendo (< 3 dias)*, *Recentes (3–20 dias)* e *Consolidados (21+ dias)*.
  * **Previsão para 7 Dias**: Carga diária programada de revisões.
  * **Mapa de Constância (12 semanas)**: Grade diária de atividade no estilo do GitHub.
  * Cálculo automático de **Ofensiva diária (*Streak*)** e **Taxa de Retenção (30 dias)**.

* 🔒 **Backend Seguro com Supabase & RLS**:
  * Autenticação completa por e-mail e senha.
  * Banco de dados PostgreSQL com **Row-Level Security (RLS)** estrito via `(select auth.uid()) = user_id`.
  * Índices otimizados para consultas de fila e auditoria de revisões.

* 🎨 **Micro-interações com Motion & Background Neural**:
  * Tela de autenticação com animação em `<canvas>` simulando neurônios, sinapses e propagação de impulsos elétricos com atração pelo cursor e disparos ao toque/clique.

---

## ✦ Tecnologias Utilizadas

| Camada | Ferramenta |
| :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build & Bundler** | [Vite 6](https://vitejs.dev/) |
| **Estilização** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Animações** | [Motion](https://motion.dev/) (Framer Motion moderno) |
| **Banco & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + RLS) |
| **Ícones** | [mx-icons](https://www.npmjs.com/package/mx-icons) (SVG inline árvore-shakable) |
| **Desktop & Mobile** | [Tauri v2](https://v2.tauri.app/) (Rust + WebView nativo para Windows & Android) |

---

## ✦ Como Rodar Localmente

### Pré-requisitos
* **Node.js** v18 ou superior instalado.
* Uma conta gratuita no **[Supabase](https://supabase.com/)**.

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/synapse.git
cd synapse
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto com base no arquivo [.env.example](.env.example):

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave_aqui
```

> **Nota**: O projeto aceita tanto `VITE_SUPABASE_PUBLISHABLE_KEY` quanto a tradicional `VITE_SUPABASE_ANON_KEY`.

### 4. Criar as tabelas no Supabase
Abra o painel do seu projeto no Supabase, acesse o **SQL Editor**, cole o conteúdo do arquivo [supabase/schema.sql](supabase/schema.sql) e clique em **Run**.

O script irá criar:
* Tabela `public.decks` (baralhos)
* Tabela `public.cards` (cartões e estado SM-2)
* Tabela `public.review_logs` (histórico de avaliações)
* Índices de performance e políticas completas de **Row-Level Security (RLS)**

### 5. Iniciar o servidor de desenvolvimento web
```bash
npm run dev
```

Acesse **http://localhost:5173** no seu navegador.

---

## ✦ Aplicativo Desktop (Windows) e Mobile (Android) via Tauri v2

O Synapse pode ser executado e compilado nativamente para **Windows (.exe / .msi)** e **Android (.apk)** utilizando [Tauri v2](https://v2.tauri.app/).

### 1. Rodar localmente como aplicativo desktop no Windows
```bash
npm run tauri dev
```

### 2. Gerar instalador para Windows de produção
```bash
npm run tauri build
```
Os arquivos gerados estarão disponíveis em:
`src-tauri/target/release/bundle/nsis/` (.exe) e `src-tauri/target/release/bundle/msi/` (.msi).

### 3. Gerar APK para Android
Com o Android SDK e NDK configurados (via Android Studio):
```bash
npm run tauri android build -- --apk
```
O arquivo `.apk` será gerado em:
`src-tauri/gen/android/app/build/outputs/apk/universal/release/`

---

## ✦ Atualizações Automáticas (Auto-Update)

O Synapse conta com atualização automática embutida tanto no desktop quanto no mobile:

1. **No Windows (Tauri Updater)**:
   * O aplicativo verifica silenciosamente ao iniciar se há uma versão mais recente publicada nos releases do GitHub.
   * Quando uma nova versão é detectada, uma notificação discreta aparece oferecendo a opção de **"Atualizar e reiniciar"**.
   * O download é verificado criptograficamente com a chave pública do Tauri e aplicado sem necessidade de reinstalar o aplicativo manualmente.

2. **No Android (APK)**:
   * O aplicativo detecta a versão e exibe um atalho direto para download e instalação do APK mais recente disponibilizado no GitHub Release.

3. **Lançamento Automático via GitHub Actions (CI/CD)**:
   O repositório inclui a pipeline [.github/workflows/release.yml](.github/workflows/release.yml). Sempre que você subir uma tag de versão, a compilação e a distribuição do Windows (.exe, .msi, artefatos de update) e Android (.apk) acontecem 100% de forma automática na nuvem:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
   *Basta configurar os Secrets `TAURI_SIGNING_PRIVATE_KEY`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas configurações do repositório no GitHub.*

---

## ✦ Scripts Disponíveis

* `npm run dev`: Inicia o servidor local de desenvolvimento com Hot Module Replacement (HMR).
* `npm run build`: Executa a checagem de tipos com o compilador TypeScript (`tsc -b`) e compila o código minificado para produção na pasta `dist/`.
* `npm run preview`: Serve os arquivos estáticos da pasta `dist/` localmente para teste de pré-produção.

---

## ✦ Estrutura de Arquivos

```
├── public/
│   └── favicon.svg           # Ícone vetorial minimalista
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthScreen.tsx       # Telas de login, cadastro e recuperação
│   │   │   └── NeuralBackground.tsx # Canvas interativo com nós e impulsos
│   │   ├── Editors.tsx              # Modais de criação/edição de baralhos e cartões
│   │   ├── icons.tsx                # Mapeamento e encapsulamento do mx-icons
│   │   ├── MarkdownContent.tsx      # Renderizador seguro de Markdown e blocos de código
│   │   └── ui.tsx                   # Primitivas de UI, Botões, Modais e Toasts
│   ├── hooks/
│   │   ├── useAuth.ts               # Listener de sessão e autenticação do Supabase
│   │   ├── useLibrary.ts            # Gerenciador de estado reativo e otimista (CRUD + SM-2)
│   │   └── useTheme.ts              # Gerenciador do tema claro/escuro com persistência
│   ├── lib/
│   │   ├── format.ts                # Utilitários de data relativa e pluralização
│   │   ├── sm2.ts                   # Implementação pura do algoritmo SuperMemo-2
│   │   ├── stats.ts                 # Cálculos de ofensiva, retenção e previsões
│   │   └── supabase.ts              # Cliente Supabase, mapeadores e chamadas à API
│   ├── types/
│   │   └── flashcard.ts             # Tipos TypeScript de baralhos, cartões e revisões
│   ├── views/
│   │   ├── DecksView.tsx            # Gerenciador de baralhos e listagem de cartões
│   │   ├── StatsView.tsx            # Dashboard de métricas, constância e maturidade
│   │   └── StudyView.tsx            # Mesa principal de estudo com pilha de cartões
│   ├── App.tsx                      # Componente raiz, roteamento por abas e barra de navegação
│   ├── index.css                    # Tokens de cor CSS e diretivas Tailwind CSS v4
│   └── main.tsx                     # Ponto de entrada React
├── supabase/
│   └── schema.sql                   # Esquema SQL, índices e políticas RLS para o PostgreSQL
├── .env.example                     # Exemplo de configuração das chaves de ambiente
└── package.json                     # Dependências e scripts do projeto
```

---

## ✦ O Algoritmo SM-2

O algoritmo **SuperMemo-2** calcula quando você deve rever um conceito com base no esforço necessário para recordá-lo.

$$I(n) = \begin{cases} 
1 \text{ dia}, & \text{se } n = 1 \\
4 \text{ dias}, & \text{se } n = 2 \\
I(n-1) \times EF, & \text{se } n > 2 
\end{cases}$$

Onde:
* **$I(n)$** é o intervalo em dias para a próxima repetição.
* **$EF$** (*Ease Factor* ou Fator de Facilidade) mede a facilidade do conceito (inicia em $2.50$ e tem valor mínimo de $1.30$).
* **Lapses**: Sempre que você erra um cartão (nota `1`), a repetição é zerada e o cartão é reagendado para o mesmo dia (~10 minutos), evitando que você passe adiante sem fixar o conceito.

---

## ✦ Licença

Este projeto é disponibilizado sob a licença [MIT](LICENSE). Sinta-se livre para usar, estudar, modificar e distribuir.


import { useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Button, Field, IconButton, Logo, softSpring, spring } from '../ui';
import { Icon } from '../icons';
import { NeuralBackground } from './NeuralBackground';

type Mode = 'signin' | 'signup' | 'reset';

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Já existe uma conta com este e-mail. Entre ou redefina a senha.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (m.includes('unable to validate email') || m.includes('invalid format')) return 'Informe um e-mail válido.';
  if (m.includes('failed to fetch')) return 'Sem conexão com o servidor. Verifique sua internet.';
  return message;
}

/** Moldura compartilhada: fundo neural + cartão central. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#121212]">
      <NeuralBackground />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(18,18,18,0.92) 0%, rgba(18,18,18,0.55) 55%, rgba(18,18,18,0) 100%)',
        }}
      />

      <header className="pointer-events-none relative z-10 flex items-center gap-2.5 px-5 pt-5 sm:px-10 sm:pt-8">
        <Logo size={26} inverted />
        <span className="text-[15px] font-semibold tracking-tight text-white">Synapse</span>
      </header>

      <main className="pointer-events-none relative z-10 flex min-h-[calc(100dvh-76px)] items-center justify-center px-4 py-6 sm:py-10">
        <motion.div
          className="pointer-events-auto w-full max-w-[400px]"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...softSpring, delay: 0.1 }}
        >
          {children}
        </motion.div>
      </main>

      <p className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-xs text-white/35 sm:bottom-5">
        Toque no fundo para disparar uma sinapse
      </p>
    </div>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<{ email: string; kind: 'confirm' | 'reset' } | null>(null);
  const shake = useAnimationControls();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const showError = (msg: string) => {
    setError(msg);
    shake.start({ x: [0, -8, 7, -5, 3, 0], transition: { duration: 0.4 } });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // Supabase devolve identities vazio quando o e-mail já existe (proteção contra enumeração)
        if (data.user && data.user.identities?.length === 0) {
          throw new Error('User already registered');
        }
        if (!data.session) setSentTo({ email, kind: 'confirm' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSentTo({ email, kind: 'reset' });
      }
    } catch (err) {
      showError(translateAuthError(err instanceof Error ? err.message : 'Algo deu errado.'));
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthFrame>
        <div className="rounded-2xl bg-surface p-8 text-center shadow-pop">
          <motion.div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-ink"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
          >
            <Icon.Mail size={22} />
          </motion.div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Confira seu e-mail</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {sentTo.kind === 'confirm'
              ? 'Enviamos um link de confirmação para '
              : 'Enviamos um link para redefinir a senha para '}
            <span className="font-medium text-ink">{sentTo.email}</span>. Abra-o neste navegador para continuar.
          </p>
          <Button
            variant="secondary"
            className="mt-6 w-full"
            onClick={() => {
              setSentTo(null);
              switchMode('signin');
            }}
          >
            Voltar para o login
          </Button>
        </div>
      </AuthFrame>
    );
  }

  const copy = {
    signin: { title: 'Bem-vindo de volta', subtitle: 'Entre para continuar suas revisões.', cta: 'Entrar' },
    signup: { title: 'Crie sua conta', subtitle: 'Seus baralhos ficam salvos e sincronizados.', cta: 'Criar conta' },
    reset: { title: 'Redefinir senha', subtitle: 'Enviaremos um link para o seu e-mail.', cta: 'Enviar link' },
  }[mode];

  return (
    <AuthFrame>
      <motion.div animate={shake} className="rounded-2xl bg-surface p-7 shadow-pop sm:p-8">
        {mode !== 'reset' ? (
          <div className="relative mb-7 grid grid-cols-2 rounded-xl bg-sunken p-1 ring-1 ring-line" role="tablist">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`relative z-10 h-9 rounded-lg text-[13px] font-medium transition-colors ${
                  mode === m ? 'text-ink' : 'text-muted hover:text-ink-2'
                }`}
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]"
                    transition={spring}
                  />
                )}
                {m === 'signin' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <Icon.ArrowLeft size={16} />
            Voltar
          </button>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            <h1 className="text-[22px] font-semibold tracking-tight">{copy.title}</h1>
            <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
          </motion.div>
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate={false}>
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Icon.Mail size={18} />}
          />

          <AnimatePresence initial={false}>
            {mode !== 'reset' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Field
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  placeholder={mode === 'signup' ? 'Mínimo de 6 caracteres' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Icon.Lock size={18} />}
                  trailing={
                    <IconButton
                      label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <Icon.EyeOff size={17} /> : <Icon.Eye size={17} />}
                    </IconButton>
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>

          {mode === 'signin' && (
            <div className="-mt-1 flex justify-end">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-[13px] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 overflow-hidden text-[13px] text-[#b42318]"
              >
                <Icon.Danger size={16} className="mt-px shrink-0" />
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <Button type="submit" size="lg" loading={loading} className="w-full">
            {copy.cta}
          </Button>
        </form>
      </motion.div>
    </AuthFrame>
  );
}

/** Exibida após clicar no link de redefinição de senha recebido por e-mail. */
export function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(translateAuthError(error.message));
  };

  return (
    <AuthFrame>
      <div className="rounded-2xl bg-surface p-7 shadow-pop sm:p-8">
        <h1 className="text-[22px] font-semibold tracking-tight">Nova senha</h1>
        <p className="mt-1 text-sm text-muted">Escolha uma senha nova para sua conta.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Mínimo de 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Icon.Lock size={18} />}
          />
          {error && (
            <p role="alert" className="text-[13px] text-[#b42318]">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Salvar nova senha
          </Button>
        </form>
      </div>
    </AuthFrame>
  );
}


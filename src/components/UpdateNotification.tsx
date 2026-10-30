import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { checkForUpdate, installUpdate, isAndroidUserAgent, isTauri, type AppUpdateStatus } from '../lib/updater';
import { Button, IconButton, softSpring } from './ui';
import { Icon } from './icons';

export function UpdateBanner() {
  const [status, setStatus] = useState<AppUpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    readyToRestart: false,
    error: null,
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    // Verifica atualizações automaticamente 3 segundos após o início (apenas no Tauri)
    const timer = setTimeout(async () => {
      try {
        const info = await checkForUpdate();
        if (info.available) {
          setStatus((prev) => ({
            ...prev,
            available: true,
            version: info.version,
            notes: info.notes,
            apkDownloadUrl: info.apkDownloadUrl,
          }));
        }
      } catch (err: any) {
        console.warn('Erro ao verificar atualização:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!isTauri() || !status.available || dismissed) return null;

  const isAndroid = isAndroidUserAgent();
  const isDesktop = isTauri() && !isAndroid;

  const handleUpdate = async () => {
    if (isAndroid && status.apkDownloadUrl) {
      window.open(status.apkDownloadUrl, '_blank');
      return;
    }

    if (isDesktop) {
      setStatus((s) => ({ ...s, downloading: true, error: null, downloadProgress: 0 }));
      try {
        await installUpdate((progress) => {
          setStatus((s) => ({ ...s, downloadProgress: progress }));
        });
      } catch (err: any) {
        setStatus((s) => ({
          ...s,
          downloading: false,
          error: err?.message || 'Falha ao instalar atualização.',
        }));
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={softSpring}
        role="status"
        aria-live="polite"
        className="fixed top-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 rounded-2xl bg-surface/95 backdrop-blur-md p-4 shadow-overlay ring-1 ring-line"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink">
            <Icon.Refresh size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold tracking-tight text-ink">
                Nova versão disponível ({status.version ? `v${status.version}` : 'recente'})
              </h4>
              <IconButton label="Fechar" onClick={() => setDismissed(true)}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </IconButton>
            </div>

            <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">
              {status.notes || 'Atualização com correções e novas melhorias para seus estudos.'}
            </p>

            {status.downloading && (
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-muted mb-1">
                  <span>Baixando atualização...</span>
                  <span className="tabular">{status.downloadProgress ?? 0}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full bg-ink transition-all duration-200"
                    style={{ width: `${status.downloadProgress ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {status.error && (
              <p className="mt-2 text-xs text-red-500 font-medium">{status.error}</p>
            )}

            {!status.downloading && (
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={handleUpdate}>
                  {isAndroid ? 'Baixar APK atualizado' : 'Atualizar e reiniciar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                  Lembrar mais tarde
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

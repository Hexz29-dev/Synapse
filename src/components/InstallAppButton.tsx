import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { getWebInstallerInfo, isAndroidUserAgent, isTauri, type WebInstallerInfo } from '../lib/updater';
import { Button, spring } from './ui';
import { Icon } from './icons';

interface InstallAppButtonProps {
  variant?: 'header' | 'auth';
}

/**
 * Botão exibido apenas na versão Web (navegador) para baixar e instalar o aplicativo nativo:
 * - No Android: baixa o APK mais recente.
 * - No Computador: baixa o instalador NSIS (.exe) mais recente.
 */
export function InstallAppButton({ variant = 'header' }: InstallAppButtonProps) {
  const [info, setInfo] = useState<WebInstallerInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const isWeb = !isTauri();
  const isAndroid = isAndroidUserAgent();

  useEffect(() => {
    if (!isWeb) return;
    let active = true;
    getWebInstallerInfo().then((resolved) => {
      if (active) setInfo(resolved);
    });
    return () => {
      active = false;
    };
  }, [isWeb]);

  if (!isWeb) return null;

  const title = isAndroid
    ? `Baixar aplicativo para Android (APK${info?.version ? ` v${info.version}` : ''})`
    : `Baixar instalador para computador (NSIS${info?.version ? ` v${info.version}` : ''})`;

  const handleInstall = async () => {
    setLoading(true);
    try {
      const resolved = info ?? (await getWebInstallerInfo());
      setInfo(resolved);
      window.location.assign(resolved.url);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'auth') {
    return (
      <motion.button
        type="button"
        onClick={handleInstall}
        disabled={loading}
        title={title}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        className="inline-flex h-9 select-none items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 text-[13px] font-medium text-white/90 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
      >
        <Icon.Download size={16} />
        <span>{isAndroid ? 'Instalar APK' : 'Instalar app'}</span>
      </motion.button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      icon={<Icon.Download size={16} />}
      onClick={handleInstall}
      title={title}
    >
      <span className="hidden sm:inline">{isAndroid ? 'Instalar APK' : 'Instalar app'}</span>
      <span className="sm:hidden">{isAndroid ? 'APK' : 'App'}</span>
    </Button>
  );
}


/**
 * Serviço de verificação e aplicação de atualizações automáticas do Synapse.
 * Compatível tanto com o cliente Desktop Tauri (Windows) quanto com Android / Web.
 */

export interface AppUpdateStatus {
  checking: boolean;
  available: boolean;
  version?: string;
  notes?: string;
  downloading: boolean;
  downloadProgress?: number; // 0 - 100
  readyToRestart: boolean;
  error?: string | null;
  apkDownloadUrl?: string;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export function isAndroidUserAgent(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

// Guarda a instância ativa da atualização Tauri para poder baixar e instalar quando o usuário aceitar
let activeTauriUpdate: any = null;

/**
 * Verifica se há uma nova versão disponível.
 * No Windows (Tauri): consulta o endpoint configurado no tauri.conf.json com assinatura criptográfica.
 * No Android/Web: consulta a API pública de releases do GitHub do Synapse.
 */
export async function checkForUpdate(currentVersion: string = '1.0.0'): Promise<{
  available: boolean;
  version?: string;
  notes?: string;
  apkDownloadUrl?: string;
}> {
  if (isTauri()) {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        activeTauriUpdate = update;
        return {
          available: true,
          version: update.version,
          notes: update.body || 'Correções e melhorias de desempenho.',
        };
      }

      return { available: false };
    } catch (err: any) {
      console.warn('[Updater] Erro ao verificar via Tauri updater:', err);
    }
  }

  // Fallback: consulta direta aos releases do GitHub
  try {
    const res = await fetch('https://api.github.com/repos/Hexz29-dev/Synapse/releases/latest', {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!res.ok) return { available: false };

    const data = await res.json();
    const latestVersion = (data.tag_name || '').replace(/^v/, '');

    if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
      // Procura asset APK para Android
      const apkAsset = Array.isArray(data.assets)
        ? data.assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.apk'))
        : null;

      return {
        available: true,
        version: latestVersion,
        notes: data.body || 'Nova versão disponível.',
        apkDownloadUrl: apkAsset ? apkAsset.browser_download_url : data.html_url,
      };
    }
  } catch (err) {
    console.warn('[Updater] Erro ao consultar releases do GitHub:', err);
  }

  return { available: false };
}

/**
 * Baixa e instala a atualização no Windows Desktop (Tauri).
 * Dispara reinicialização automática do app ao concluir.
 */
export async function installUpdate(
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (!activeTauriUpdate) {
    throw new Error('Nenhuma atualização pendente encontrada.');
  }

  let downloaded = 0;
  let contentLength = 0;

  await activeTauriUpdate.downloadAndInstall((event: any) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data?.contentLength || 0;
        onProgress?.(0);
        break;
      case 'Progress':
        downloaded += event.data?.chunkLength || 0;
        if (contentLength > 0 && onProgress) {
          const pct = Math.min(100, Math.round((downloaded / contentLength) * 100));
          onProgress(pct);
        }
        break;
      case 'Finished':
        onProgress?.(100);
        break;
    }
  });

  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}

/** Compara semanticamente duas versões no formato semver (e.g. 1.0.1 > 1.0.0) */
function isNewerVersion(remote: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const r = parse(remote);
  const c = parse(current);

  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rPart = r[i] ?? 0;
    const cPart = c[i] ?? 0;
    if (rPart > cPart) return true;
    if (rPart < cPart) return false;
  }

  return false;
}

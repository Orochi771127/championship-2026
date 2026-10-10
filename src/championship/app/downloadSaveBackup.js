// DOM-only download of a complete snapshot validated by the injected app seam.
// No storage access, game-state capture, save scheduling, or import here.
export function downloadSaveBackup(exportValidated, { doc = globalThis.document,
  urls = globalThis.URL, BlobClass = globalThis.Blob, defer = globalThis.setTimeout } = {}) {
  let url;
  try {
    const backup = exportValidated?.();
    if (!backup?.text || !['pending', 'stored'].includes(backup.backupSource)) throw new Error('NO_VALIDATED_BACKUP');
    url = urls.createObjectURL(new BlobClass([backup.text], { type: 'application/json' }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = backup.backupSource === 'pending' ? 'championship-recovery.json' : 'championship-backup.json';
    doc.body.append(link);
    try { link.click(); } finally { link.remove(); }
    return { ok: true, key: backup.backupSource === 'pending' ? 'BACKUP_PENDING_READY' : 'BACKUP_STORED_READY' };
  } catch {
    return { ok: false, key: 'BACKUP_FAILED' };
  } finally {
    // The existing download cleanup delay gives the browser time to open it.
    if (url) defer(() => urls.revokeObjectURL(url), 1000);
  }
}

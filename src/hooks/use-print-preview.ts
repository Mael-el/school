import { useCallback, useState } from 'react';
import type { PrintHtmlResult } from '../lib/types';
import { invokePrint } from '../lib/print';

export function usePrintPreview() {
  const [preview, setPreview] = useState<PrintHtmlResult | null>(null);

  const openPreview = useCallback(
    async (build: () => Promise<PrintHtmlResult>) => {
      const doc = await build();
      setPreview(doc);
    },
    [],
  );

  const closePreview = useCallback(() => setPreview(null), []);

  const confirmPreview = useCallback(
    async (successMessage: string) => {
      if (!preview) return;
      await invokePrint(
        () =>
          window.api.print.savePdfFromHtml(
            preview.html,
            preview.defaultFileName,
            preview.paperFormat,
            preview.footerNote,
          ),
        successMessage,
      );
      setPreview(null);
    },
    [preview],
  );

  return { preview, openPreview, closePreview, confirmPreview };
}

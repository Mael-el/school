import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { PageBackHeader } from '../components/ui/page-back-header';

export function PrintPreviewView({
  title,
  html,
  defaultFileName,
  onBack,
  onSave,
}: {
  title: string;
  html: string;
  defaultFileName: string;
  onBack: () => void;
  onSave: (html: string, fileName: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await onSave(html, defaultFileName);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageBackHeader title={title} onBack={onBack} />
      <Card>
        <CardContent className="p-0 pt-4">
          <iframe
            title={title}
            srcDoc={html}
            sandbox=""
            className="h-[min(70vh,640px)] w-full rounded-b-xl border-0 bg-white"
          />
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={busy}>
          <FileDown className="mr-2 h-4 w-4" />
          {t('print.savePdf')}
        </Button>
      </div>
    </div>
  );
}

import { FileUp, LoaderCircle, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StatementUploadProps {
  busy: boolean;
  onDemo: () => void;
  onUpload: (file: File) => void;
}

export function StatementUpload({ busy, onDemo, onUpload }: StatementUploadProps) {
  return (
    <section aria-label="Importă extrasul bancar" className="mb-7 border-y border-border py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">Începe cu tranzacțiile tale</h2>
          <p className="mt-1 text-sm text-muted-foreground">CSV-ul este procesat în memorie; se păstrează doar tranzacțiile normalizate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-secondary focus-within:ring-2 focus-within:ring-ring">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Încarcă CSV
            <input
              aria-label="Alege extras CSV"
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Button variant="outline" disabled={busy} onClick={onDemo}>
            <Table2 className="size-4" />Folosește extras demo
          </Button>
        </div>
      </div>
    </section>
  );
}

import { DID_PKH_STELLAR_PREFIX } from '@acta-products/acta/did';
import { Button } from '@acta-products/ui';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Credit History</h1>
      <p className="max-w-md text-muted-foreground">
        Portable credit history built on ACTA verifiable credentials. Product skeleton — nothing
        implemented yet.
      </p>
      <Button variant="outline" disabled>
        Coming soon
      </Button>
      <p className="text-xs text-muted-foreground">
        Default identity method: <code>{DID_PKH_STELLAR_PREFIX}</code>
      </p>
    </main>
  );
}

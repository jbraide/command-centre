'use client';

import { FileText } from 'lucide-react';

export default function InvoicesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="mb-6">
        <FileText size={64} className="text-[var(--accent)]" />
      </div>
      <h1 className="text-2xl font-bold">Invoices</h1>
      <p className="text-[var(--muted)] text-sm mt-2">Coming soon</p>
      <p className="text-[var(--muted)] text-sm mt-6 max-w-md">
        Invoice management will connect to your external API to pull and manage
        invoice data.
      </p>
      <p className="text-[var(--muted)] text-sm mt-2 max-w-md">
        You&apos;ll be able to view, create, and track invoices for LuxeRide
        and freelance work right here.
      </p>
    </div>
  );
}

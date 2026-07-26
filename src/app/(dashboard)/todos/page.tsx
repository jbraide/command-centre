'use client';

import { CheckSquare } from 'lucide-react';
import Link from 'next/link';

export default function TasksPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="mb-6">
        <CheckSquare size={64} className="text-[var(--accent)]" />
      </div>
      <h1 className="text-2xl font-bold">Tasks</h1>
      <p className="text-[var(--muted)] text-sm mt-2">Coming soon</p>
      <p className="text-[var(--muted)] text-sm mt-6 max-w-md">
        Task management is now part of Projects. Create a project to organize
        your tasks.
      </p>
      <Link
        href="/projects"
        className="mt-6 inline-block border border-[var(--border)] bg-[var(--panel)] px-5 py-2 text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        Go to Projects
      </Link>
    </div>
  );
}

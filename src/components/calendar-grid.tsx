'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CalendarItem {
  id: string;
  title: string;
  color: string;
  date: string; // YYYY-MM-DD
  allDay?: boolean;
}

interface CalendarGridProps {
  month: Date; // any date inside the displayed month
  onMonthChange: (month: Date) => void;
  items: CalendarItem[];
  onDayClick?: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function CalendarGrid({
  month,
  onMonthChange,
  items,
  onDayClick,
}: CalendarGridProps) {
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const result: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - startOffset + i);
      result.push({ date: d, inMonth: d.getMonth() === month.getMonth() });
    }
    return result;
  }, [month]);

  const todayKey = toDateKey(new Date());

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <h2 className="text-base md:text-lg font-bold text-[var(--foreground)] truncate">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="p-2 rounded-sm border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onMonthChange(new Date())}
            className="px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--panel)] text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="p-2 rounded-sm border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-[var(--border)] border border-[var(--border)] overflow-hidden rounded-sm">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-[var(--panel)] px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            {day}
          </div>
        ))}

        {cells.map((cell, i) => {
          const key = toDateKey(cell.date);
          const dayItems = items.filter((item) => item.date === key);
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              onClick={() => onDayClick?.(key)}
              className={`min-h-[62px] md:min-h-[96px] bg-[var(--panel)] p-1 md:p-1.5 cursor-pointer transition-colors ${
                cell.inMonth
                  ? 'hover:bg-[var(--background)]'
                  : 'opacity-40 hover:opacity-70'
              } ${isToday ? 'ring-1 ring-inset ring-[var(--accent)]' : ''}`}
            >
              <div
                className={`text-xs mb-1 ${
                  isToday
                    ? 'font-bold text-[var(--accent)]'
                    : 'text-[var(--muted)]'
                }`}
              >
                {cell.date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    title={item.title}
                    className="rounded-sm px-1 py-0.5 text-[10px] md:text-xs leading-tight truncate text-black"
                    style={{ backgroundColor: item.color }}
                  >
                    <span className="hidden md:inline">{item.title}</span>
                    <span className="md:hidden">•</span>
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <div className="text-[10px] text-[var(--muted)] px-0.5">
                    +{dayItems.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

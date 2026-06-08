import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function getPageNumbers(page: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  if (page <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (page >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', page - 1, page, page + 1, '...', total];
}

export function Pager({ page, totalPages, onPageChange, className }: Props) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  return (
    <nav
      role="navigation"
      aria-label="分頁導覽"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="上一頁"
        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        <ChevronLeftIcon className="size-4" />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span
            key={`ellipsis-${i}`}
            aria-hidden
            className="flex items-center justify-center w-8 h-8 text-slate-400"
          >
            <MoreHorizontalIcon className="size-4" />
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg text-[13px] font-medium transition-colors cursor-pointer',
              p === page
                ? 'bg-indigo-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="下一頁"
        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </nav>
  );
}

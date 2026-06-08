import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Tab {
  to: string;
  label: string;
}

interface Props {
  tabs: Tab[];
}

export function SubTabNav({ tabs }: Props) {
  return (
    <div className="flex border-b border-border mb-5 gap-1">
      {tabs.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'px-4 py-2 text-[13px] no-underline transition-colors -mb-px border-b-2',
              isActive
                ? 'text-primary font-semibold border-primary'
                : 'text-muted-foreground font-normal border-transparent'
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </div>
  );
}

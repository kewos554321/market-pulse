import { NavLink } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
}

interface Props {
  tabs: Tab[];
}

export function SubTabNav({ tabs }: Props) {
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid #e2e8f0',
      marginBottom: '20px', gap: '4px',
    }}>
      {tabs.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          style={({ isActive }) => ({
            padding: '8px 16px',
            fontSize: '13px',
            textDecoration: 'none',
            color: isActive ? '#6366f1' : '#64748b',
            fontWeight: isActive ? 600 : 400,
            borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
            marginBottom: '-1px',
            transition: 'color 0.15s',
          })}
        >
          {label}
        </NavLink>
      ))}
    </div>
  );
}

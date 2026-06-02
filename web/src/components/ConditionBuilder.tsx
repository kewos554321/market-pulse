import type { ConditionLeaf, ConditionTree } from '../types';

type Condition = ConditionLeaf | ConditionTree;

interface Props {
  conditions: ConditionTree;
  onChange: (tree: ConditionTree) => void;
}

const INDICATORS = ['RSI', 'CLOSE', 'MA', 'VOLUME', 'KD_CROSS', 'MACD_CROSS'] as const;
const OPS = ['<', '>', '<=', '>=', '='] as const;

function isTree(c: Condition): c is ConditionTree {
  return 'operator' in c;
}

function defaultLeaf(): ConditionLeaf {
  return { indicator: 'RSI', period: 14, op: '<', value: 30 };
}

function LeafRow({
  leaf,
  onChange,
  onDelete,
}: {
  leaf: ConditionLeaf;
  onChange: (l: ConditionLeaf) => void;
  onDelete: () => void;
}) {
  const isCross = ['KD_CROSS', 'MACD_CROSS'].includes(leaf.indicator);

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
      <select
        value={leaf.indicator}
        onChange={(e) => onChange({ ...defaultLeaf(), indicator: e.target.value as ConditionLeaf['indicator'] })}
      >
        {INDICATORS.map((i) => <option key={i} value={i}>{i}</option>)}
      </select>

      {isCross && (
        <select
          value={leaf.direction ?? 'golden'}
          onChange={(e) => onChange({ ...leaf, direction: e.target.value as 'golden' | 'dead' })}
        >
          <option value="golden">黃金交叉</option>
          <option value="dead">死亡交叉</option>
        </select>
      )}

      {!isCross && (
        <>
          {['RSI', 'MA', 'CLOSE'].includes(leaf.indicator) && (
            <input
              type="number"
              placeholder="期間"
              value={leaf.period ?? ''}
              style={{ width: '60px' }}
              onChange={(e) => onChange({ ...leaf, period: Number(e.target.value) })}
            />
          )}
          <select
            value={leaf.op ?? '<'}
            onChange={(e) => onChange({ ...leaf, op: e.target.value as ConditionLeaf['op'] })}
          >
            {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={leaf.ref ? 'ref' : 'value'}
            onChange={(e) => onChange(
              e.target.value === 'ref'
                ? { ...leaf, ref: 'MA', value: undefined, period: 20 }
                : { ...leaf, ref: undefined, value: 30 }
            )}
          >
            <option value="value">數值</option>
            <option value="ref">均線</option>
          </select>
          {leaf.ref ? (
            <select
              value={leaf.period ?? 20}
              onChange={(e) => onChange({ ...leaf, period: Number(e.target.value) })}
            >
              {[5, 10, 20, 60].map((p) => <option key={p} value={p}>MA{p}</option>)}
            </select>
          ) : (
            <input
              type="number"
              value={leaf.value ?? ''}
              style={{ width: '80px' }}
              onChange={(e) => onChange({ ...leaf, value: Number(e.target.value) })}
            />
          )}
        </>
      )}

      <button onClick={onDelete} style={{ color: 'red' }}>✕</button>
    </div>
  );
}

export function ConditionBuilder({ conditions, onChange }: Props) {
  function updateCondition(index: number, updated: Condition) {
    const next = [...conditions.conditions];
    next[index] = updated;
    onChange({ ...conditions, conditions: next });
  }

  function deleteCondition(index: number) {
    onChange({ ...conditions, conditions: conditions.conditions.filter((_, i) => i !== index) });
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <span>邏輯：</span>
        <select
          value={conditions.operator}
          onChange={(e) => onChange({ ...conditions, operator: e.target.value as 'AND' | 'OR' })}
        >
          <option value="AND">AND（全部符合）</option>
          <option value="OR">OR（任一符合）</option>
        </select>
      </div>

      {conditions.conditions.map((c, i) => (
        <div key={i}>
          {isTree(c) ? (
            <div style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
              <ConditionBuilder
                conditions={c}
                onChange={(updated) => updateCondition(i, updated)}
              />
              <button onClick={() => deleteCondition(i)} style={{ color: 'red', marginTop: '0.25rem' }}>
                刪除子群組
              </button>
            </div>
          ) : (
            <LeafRow
              leaf={c}
              onChange={(updated) => updateCondition(i, updated)}
              onDelete={() => deleteCondition(i)}
            />
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button onClick={() => onChange({ ...conditions, conditions: [...conditions.conditions, defaultLeaf()] })}>
          + 新增條件
        </button>
        <button onClick={() => onChange({
          ...conditions,
          conditions: [...conditions.conditions, { operator: 'AND', conditions: [defaultLeaf()] }],
        })}>
          + 子群組
        </button>
      </div>
    </div>
  );
}

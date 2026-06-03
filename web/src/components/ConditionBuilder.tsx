import type { ConditionLeaf, ConditionTree } from '../types';

type Condition = ConditionLeaf | ConditionTree;

interface Props {
  conditions: ConditionTree;
  onChange: (tree: ConditionTree) => void;
}

const INDICATORS = ['RSI', 'CLOSE', 'MA', 'VOLUME', 'KD_CROSS', 'MACD_CROSS'] as const;
const OPS = ['<', '>', '<=', '>=', '='] as const;

const selectStyle: React.CSSProperties = {
  border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px',
  fontSize: '12px', color: '#374151', outline: 'none', background: '#fff',
};

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px',
  fontSize: '12px', color: '#374151', outline: 'none', width: '70px',
};

function isTree(c: Condition): c is ConditionTree {
  return 'operator' in c;
}

function defaultLeaf(): ConditionLeaf {
  return { indicator: 'RSI', period: 14, op: '<', value: 30 };
}

function LeafRow({
  leaf, onChange, onDelete,
}: {
  leaf: ConditionLeaf;
  onChange: (l: ConditionLeaf) => void;
  onDelete: () => void;
}) {
  const isCross = ['KD_CROSS', 'MACD_CROSS'].includes(leaf.indicator);

  return (
    <div style={{
      display: 'flex', gap: '8px', alignItems: 'center',
      padding: '10px 12px', background: '#f8fafc', borderRadius: '8px',
    }}>
      <select
        value={leaf.indicator}
        onChange={(e) => onChange({ ...defaultLeaf(), indicator: e.target.value as ConditionLeaf['indicator'] })}
        style={selectStyle}
      >
        {INDICATORS.map((i) => <option key={i} value={i}>{i}</option>)}
      </select>

      {isCross && (
        <select
          value={leaf.direction ?? 'golden'}
          onChange={(e) => onChange({ ...leaf, direction: e.target.value as 'golden' | 'dead' })}
          style={selectStyle}
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
              style={inputStyle}
              onChange={(e) => onChange({ ...leaf, period: Number(e.target.value) })}
            />
          )}
          <select
            value={leaf.op ?? '<'}
            onChange={(e) => onChange({ ...leaf, op: e.target.value as ConditionLeaf['op'] })}
            style={selectStyle}
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
            style={selectStyle}
          >
            <option value="value">數值</option>
            <option value="ref">均線</option>
          </select>
          {leaf.ref ? (
            <select
              value={leaf.period ?? 20}
              onChange={(e) => onChange({ ...leaf, period: Number(e.target.value) })}
              style={selectStyle}
            >
              {[5, 10, 20, 60].map((p) => <option key={p} value={p}>MA{p}</option>)}
            </select>
          ) : (
            <input
              type="number"
              value={leaf.value ?? ''}
              style={inputStyle}
              onChange={(e) => onChange({ ...leaf, value: Number(e.target.value) })}
            />
          )}
        </>
      )}

      <button
        onClick={onDelete}
        style={{
          background: '#fff0f0', color: '#ef4444', border: 'none',
          borderRadius: '6px', padding: '6px 10px', fontSize: '12px',
          cursor: 'pointer', marginLeft: 'auto',
        }}
      >
        ✕
      </button>
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>邏輯：</span>
        <select
          value={conditions.operator}
          onChange={(e) => onChange({ ...conditions, operator: e.target.value as 'AND' | 'OR' })}
          style={selectStyle}
        >
          <option value="AND">AND（全部符合）</option>
          <option value="OR">OR（任一符合）</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {conditions.conditions.map((c, i) => (
          <div key={i}>
            {isTree(c) ? (
              <div style={{
                marginLeft: '12px', padding: '12px',
                borderLeft: '2px solid #e2e8f0', borderRadius: '0 8px 8px 0',
              }}>
                <ConditionBuilder
                  conditions={c}
                  onChange={(updated) => updateCondition(i, updated)}
                />
                <button
                  onClick={() => deleteCondition(i)}
                  style={{
                    background: '#fff0f0', color: '#ef4444', border: 'none',
                    borderRadius: '6px', padding: '4px 10px', fontSize: '12px',
                    cursor: 'pointer', marginTop: '8px',
                  }}
                >
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

        {conditions.conditions.length === 0 && (
          <div style={{
            padding: '20px', textAlign: 'center', color: '#94a3b8',
            fontSize: '13px', border: '1px dashed #e2e8f0', borderRadius: '8px',
          }}>
            還沒有條件，點下方按鈕新增
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onChange({ ...conditions, conditions: [...conditions.conditions, defaultLeaf()] })}
          style={{
            background: '#eff6ff', color: '#6366f1', border: 'none',
            borderRadius: '6px', padding: '7px 14px', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          + 新增條件
        </button>
        <button
          onClick={() => onChange({
            ...conditions,
            conditions: [...conditions.conditions, { operator: 'AND', conditions: [defaultLeaf()] }],
          })}
          style={{
            background: '#f1f5f9', color: '#64748b', border: 'none',
            borderRadius: '6px', padding: '7px 14px', fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          + 子群組
        </button>
      </div>
    </div>
  );
}

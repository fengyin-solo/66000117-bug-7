import React from 'react';
import { FetchStatus } from '../store/eeg';

interface Props {
  status: FetchStatus;
  error: string | null;
  large?: boolean;
}

/**
 * 实时采样状态提示：加载/失败（超时、空值、后端不可用）/ 恢复成功均在此呈现。
 * 失败时父组件保留最后有效数据，本组件仅给出可见状态，不覆盖波形与信号状态。
 */
export const FetchStatusHint: React.FC<Props> = ({ status, error, large }) => {
  if (status === 'loading') {
    return (
      <span style={large ? { color: '#999', fontSize: 14 } : { fontSize: '12px', color: '#999' }}>
        {large ? '加载中…' : '刷新中…'}
      </span>
    );
  }
  if (status === 'error' && error) {
    return (
      <span
        style={{
          fontSize: large ? 14 : '12px',
          color: '#d32f2f',
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title={error}
      >
        ⚠ {error}
      </span>
    );
  }
  return null;
};

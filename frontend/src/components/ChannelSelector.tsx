import React from 'react';
import { useEEGStore } from '../store/eeg';
import { ALL_CHANNELS, channelName } from '../constants';

export const ChannelSelector: React.FC = () => {
  const { selectedChannel, setChannel, playbackMode } = useEEGStore();

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#90caf9' }}>通道选择</h3>
      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(21, 101, 192, 0.2)', borderRadius: '8px', border: '2px solid #1565c0' }}>
        <div style={{ fontSize: '11px', color: '#90caf9', marginBottom: '4px' }}>
          {playbackMode ? '回放通道' : '当前关注'}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '1px' }}>{selectedChannel}</div>
        <div style={{ fontSize: '12px', color: '#90caf9', marginTop: '2px' }}>{channelName(selectedChannel)}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {ALL_CHANNELS.map(ch => {
          const active = selectedChannel === ch;
          const disabled = playbackMode;
          return (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              disabled={disabled}
              title={playbackMode ? `回放中已锁定为 ${ch === selectedChannel ? selectedChannel : '录制通道'}` : channelName(ch)}
              style={{
                padding: active ? '8px 14px' : '6px 12px',
                borderRadius: '16px',
                border: active ? '2px solid #64b5f6' : '1px solid #37474f',
                background: active ? '#1565c0' : '#1e293b',
                color: active ? '#fff' : '#94a3b8',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !active ? 0.4 : 1,
                fontSize: active ? '13px' : '12px',
                fontWeight: active ? 700 : 400,
                transition: 'all 0.2s ease',
                boxShadow: active ? '0 2px 8px rgba(21, 101, 192, 0.5)' : 'none',
                transform: active ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              {ch}
            </button>
          );
        })}
      </div>
      {playbackMode && (
        <div style={{ marginTop: '10px', fontSize: '11px', color: '#90caf9' }}>⏮ 回放期间通道已锁定，退出后可切换</div>
      )}
    </div>
  );
};

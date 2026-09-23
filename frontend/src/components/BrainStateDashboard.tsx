import React from 'react';
import { useEEGStore } from '../store/eeg';
import { channelName } from '../constants';

const ScoreBar: React.FC<{ label: string; value: number; color: string; icon: string }> = ({ label, value, color, icon }) => {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#333', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{icon}</span>
          {label}
        </span>
        <span style={{ fontSize: '16px', fontWeight: 700, color }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: '10px', background: '#e0e0e0', borderRadius: '5px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: color,
            borderRadius: '5px',
            transition: 'width 0.5s ease-out',
          }}
        />
      </div>
    </div>
  );
};

export const BrainStateDashboard: React.FC = () => {
  const {
    brainState, sampleChannel, selectedChannel, playbackMode, activeRecording, playbackState,
    streamStatus, streamError,
  } = useEEGStore();
  const name = channelName(selectedChannel);
  // 信号状态只接受当前通道（回放期为录制通道）的结果，避免显示上一通道的旧状态
  const activeBrainState =
    playbackMode || sampleChannel === selectedChannel ? brainState : null;
  const failed = streamStatus === 'error' && !playbackMode;
  const loading = streamStatus === 'loading' && !playbackMode;
  const waiting = !activeBrainState;

  const headerBlock = (
    <div style={{
      marginBottom: '16px',
      padding: '16px',
      background: playbackMode
        ? 'linear-gradient(135deg, #6a1b9a, #4a148c)'
        : 'linear-gradient(135deg, #1565c0, #0d47a1)',
      borderRadius: '10px',
      color: '#fff',
      textAlign: 'center',
      boxShadow: playbackMode
        ? '0 4px 12px rgba(106, 27, 154, 0.4)'
        : '0 4px 12px rgba(21, 101, 192, 0.4)',
      transition: 'all 0.3s ease',
    }}>
      <div style={{ fontSize: '11px', opacity: 0.85, marginBottom: '4px' }}>
        {playbackMode ? '回放通道' : '当前关注通道'}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '2px' }}>{selectedChannel}</div>
      <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>{name}</div>
      {playbackMode && activeRecording && (
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '6px' }}>
          📼 {activeRecording.name} · {playbackState.currentTime.toFixed(1)}s
        </div>
      )}
    </div>
  );

  const titleBlock = (
    <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span>🧠</span>
      {playbackMode ? '回放脑状态' : '实时脑状态'}
      {playbackMode && <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放中</span>}
      {!playbackMode && streamStatus === 'online' && (
        <span style={{ fontSize: '12px', color: '#388e3c', fontWeight: 500 }}>● 已连接</span>
      )}
      {!playbackMode && loading && <span style={{ fontSize: '12px', color: '#999' }}>刷新中...</span>}
      {failed && <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>⚠ {streamError || '连接失败'}</span>}
    </h3>
  );

  if (waiting) {
    return (
      <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {headerBlock}
        {titleBlock}
        <div style={{
          padding: failed ? '28px 16px' : '40px 0',
          textAlign: 'center',
          color: failed ? '#c62828' : '#999',
          fontSize: '13px',
          background: failed ? '#fff5f5' : 'transparent',
          border: failed ? '1px dashed #e57373' : 'none',
          borderRadius: '8px',
        }}>
          {failed ? '信号异常：' + (streamError || '无法获取信号状态') + '，恢复后自动更新' : '等待数据中...'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      {headerBlock}

      <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span>🧠</span>
        {playbackMode ? '回放脑状态' : '实时脑状态'}
        {playbackMode && <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放模式</span>}
        {failed && <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>⚠ {streamError}</span>}
      </h3>

      <div
        style={{
          padding: '20px',
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${activeBrainState!.statusColor}15, ${activeBrainState!.statusColor}08)`,
          border: `2px solid ${activeBrainState!.statusColor}`,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>当前状态</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: activeBrainState!.statusColor, letterSpacing: '2px' }}>
            {activeBrainState!.statusLabel}
          </div>
        </div>
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: activeBrainState!.statusColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            boxShadow: `0 0 20px ${activeBrainState!.statusColor}40`,
            animation: 'pulse 2s infinite',
          }}
        >
          {activeBrainState!.status === 'focused' ? '🎯' : activeBrainState!.status === 'relaxed' ? '🍃' : activeBrainState!.status === 'fatigued' ? '😴' : '🧘'}
        </div>
      </div>

      <ScoreBar label="专注度" value={activeBrainState!.focus} color="#1976d2" icon="🎯" />
      <ScoreBar label="放松度" value={activeBrainState!.relaxation} color="#388e3c" icon="🍃" />
      <ScoreBar label="疲劳度" value={activeBrainState!.fatigue} color="#d32f2f" icon="😴" />

      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #eee', fontSize: '11px', color: '#999', textAlign: 'right' }}>
        最后更新: {new Date(activeBrainState!.timestamp).toLocaleTimeString()}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
};

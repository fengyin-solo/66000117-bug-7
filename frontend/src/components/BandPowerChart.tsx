import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { channelName } from '../constants';

const COLORS = ['#1565c0','#2e7d32','#f9a825','#e53935','#6a1b9a'];
const LABELS = ['Delta','Theta','Alpha','Beta','Gamma'];

export const BandPowerChart: React.FC = () => {
  const { bandPower, sampleChannel, selectedChannel, playbackMode, streamStatus, streamError } = useEEGStore();
  const name = channelName(selectedChannel);
  // 数据必须属于当前通道，否则视为无数据，避免上一通道的频段柱残留
  const activeBandPower = playbackMode || sampleChannel === selectedChannel ? bandPower : null;
  const failed = streamStatus === 'error' && !playbackMode;
  const loading = streamStatus === 'loading' && !playbackMode;

  if (!activeBandPower) {
    return (
      <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <span>{selectedChannel}</span>
          <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{name} · 频段能量</span>
          {playbackMode && <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放中</span>}
          {failed && <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>⚠ {streamError || '连接失败'}</span>}
        </h3>
        <div style={{
          color: failed ? '#c62828' : '#999', padding: '40px 0', textAlign: 'center',
          background: failed ? '#fff5f5' : 'transparent',
          border: failed ? '1px dashed #e57373' : 'none', borderRadius: '8px',
        }}>
          {failed ? '频段数据暂不可用，恢复后自动刷新' : loading ? '等待数据中...' : '等待数据中...'}
        </div>
      </div>
    );
  }

  const data = LABELS.map((label, i) => ({
    name: label,
    power: (activeBandPower as any)[label.toLowerCase()] || 0,
    color: COLORS[i]
  }));

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '20px' }}>📊</span>
        <span>{selectedChannel}</span>
        <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{name} · 频段能量</span>
        {playbackMode && <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放模式</span>}
        {failed && <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>⚠ {streamError}</span>}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="power" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { useActiveEEGData } from '../hooks/useActiveEEGData';
import { fetchSample } from '../api/eeg';
import { channelName } from '../constants';

const POLL_INTERVAL_MS = 3000;

const describeError = (err: unknown): string => {
  if (axiosIsCancel(err)) return '';
  if (axiosIsTimeout(err)) return '采样超时，正在重试…';
  if (axiosNoResponse(err)) return '后端服务不可用，正在重试…';
  return (err as Error)?.message || '数据获取失败，正在重试…';
};

const axiosIsCancel = (err: unknown): boolean =>
  !!err && (typeof err === 'object') && ((err as any).code === 'ERR_CANCELED' || (err as any).name === 'CanceledError');
const axiosIsTimeout = (err: unknown): boolean =>
  !!err && typeof err === 'object' && ((err as any).code === 'ECONNABORTED' || /timeout/i.test((err as any).message || ''));
const axiosNoResponse = (err: unknown): boolean => {
  const e = err as any;
  return !!e && typeof e === 'object' && !e.response && e.code !== 'ERR_CANCELED' && e.code !== 'ECONNABORTED';
};

export const WaveformChart: React.FC = () => {
  const {
    selectedChannel, setStreamLoading, applyStreamSample, setStreamError,
    streamStatus, streamError, isRecording, playbackMode,
  } = useEEGStore();
  const activeEEGData = useActiveEEGData();
  const [retryTick, setRetryTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const loadSample = useCallback(async (channel: string, seq: number) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStreamLoading();
    try {
      const sample = await fetchSample(channel, controller.signal);
      // 代次防护：切换通道 / 组件卸载 / 手动重试后，旧请求结果一律忽略
      if (seq !== requestSeqRef.current) return;
      // applyStreamSample 内部还会再按当前通道校验一次
      applyStreamSample({ ...sample, timestamp: Date.now() });
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      const message = describeError(err);
      if (message) setStreamError(message);
    }
  }, [setStreamLoading, applyStreamSample, setStreamError]);

  useEffect(() => {
    if (playbackMode) {
      // 回放期间取消所有在途实时请求
      requestSeqRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    const seq = ++requestSeqRef.current;
    loadSample(selectedChannel, seq);
    const timer = window.setInterval(() => {
      // 同一通道周期刷新；陈旧在途请求先取消，避免重试重复堆叠同一段曲线
      if (abortRef.current && useEEGStore.getState().streamStatus === 'loading') {
        abortRef.current.abort();
      }
      const nextSeq = ++requestSeqRef.current;
      loadSample(useEEGStore.getState().selectedChannel, nextSeq);
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      requestSeqRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [selectedChannel, playbackMode, retryTick, loadSample]);

  const handleRetry = () => {
    if (playbackMode) return;
    abortRef.current?.abort();
    setRetryTick(t => t + 1);
  };

  const chartData = activeEEGData?.data[selectedChannel]?.map((v: number, i: number) => ({
    t: activeEEGData.time[i]?.toFixed(3), value: Number(v.toFixed(4)),
  })) || [];

  const name = channelName(selectedChannel);
  const loading = streamStatus === 'loading' && !playbackMode;
  const failed = streamStatus === 'error' && !playbackMode;

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '20px' }}>📈</span>
        <span>{selectedChannel}</span>
        <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{name} · 波形图</span>
        {isRecording && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d32f2f', animation: 'pulse 1s infinite' }} />
            录制中
          </span>
        )}
        {playbackMode && (
          <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放模式</span>
        )}
        {loading && <span style={{ fontSize: '12px', color: '#999' }}>刷新中...</span>}
        {streamStatus === 'online' && !playbackMode && (
          <span style={{ fontSize: '12px', color: '#388e3c', fontWeight: 500 }}>● 已连接</span>
        )}
        {failed && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>
            ⚠ {streamError || '连接失败'}
            <button
              onClick={handleRetry}
              style={{
                padding: '2px 10px', fontSize: '12px', borderRadius: '12px',
                border: '1px solid #d32f2f', background: '#fff', color: '#d32f2f', cursor: 'pointer',
              }}
            >
              立即重试
            </button>
          </span>
        )}
      </h3>

      {failed && chartData.length === 0 ? (
        <div style={{
          height: 200, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          background: '#fff5f5', border: '1px dashed #e57373', borderRadius: '8px', color: '#c62828',
        }}>
          <span style={{ fontSize: '14px' }}>⚠ {streamError || '无法获取波形数据'}</span>
          <span style={{ fontSize: '12px', color: '#999' }}>将自动重试，恢复后继续显示 {selectedChannel}（{name}）</span>
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '13px' }}>
          {loading ? '等待数据中...' : playbackMode ? '暂无回放数据' : '等待数据中...'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
            <Line type="monotone" dataKey="value" stroke="#1565c0" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

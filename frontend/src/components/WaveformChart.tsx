import React, { useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { useEEGStore, isValidChannel, LiveSample } from '../store/eeg';
import { EEGData } from '../types';
import { FetchStatusHint } from './FetchStatusHint';

const CHANNEL_NAMES: Record<string, string> = {
  Fp1: '左前额', Fp2: '右前额', F3: '左额', F4: '右额',
  C3: '左中央', C4: '右中央', P3: '左顶', P4: '右顶',
  O1: '左枕', O2: '右枕'
};

const SAMPLE_DURATION = 3;
const POLL_INTERVAL_MS = 3000;
const REQUEST_TIMEOUT_MS = 5000;

// 校验回包是当前通道的一次有效采样，拒绝空值/缺字段/通道不匹配
const parseSample = (payload: any, channel: string): LiveSample | null => {
  const eeg: EEGData | undefined = payload?.eeg;
  if (!eeg || !Array.isArray(eeg.channels) || !eeg.data || !Array.isArray(eeg.time)) return null;
  const waveform = eeg.data?.[channel];
  if (!Array.isArray(waveform) || waveform.length === 0) return null;
  if (waveform.length !== eeg.time.length) return null;
  const { bands, brainState, correlation } = payload ?? {};
  if (!bands || brainState == null || !correlation?.correlations) return null;
  if (correlation.targetChannel !== channel) return null;
  return { eeg, bands, brainState, correlation };
};

export const WaveformChart: React.FC = () => {
  const {
    eegData, selectedChannel, dataChannel, fetchStatus, fetchError,
    isRecording, playbackMode,
    applyLiveSample, setFetchLoading, setFetchError,
  } = useEEGStore();

  // 每次（重新）拉取对应一个 generation；通道切换/卸载/进入回放即作废旧请求
  const generationRef = useRef(0);

  useEffect(() => {
    if (playbackMode) return;

    const channel = selectedChannel;
    const generation = ++generationRef.current;
    const controller = new AbortController();
    let timer: number | null = null;
    let cancelled = false;

    const isCurrent = () =>
      !cancelled &&
      generation === generationRef.current &&
      !useEEGStore.getState().playbackMode &&
      useEEGStore.getState().selectedChannel === channel;

    // 串行自调度：上一请求结束后才安排下一次，避免慢请求堆叠、乱序回包
    const scheduleNext = () => {
      if (isCurrent()) {
        timer = window.setTimeout(() => { void fetchEEG(); }, POLL_INTERVAL_MS);
      }
    };

    const fetchEEG = async () => {
      if (!isCurrent()) return;
      setFetchLoading();
      try {
        const { data } = await axios.get(
          `/api/eeg/sample/${channel}?duration=${SAMPLE_DURATION}`,
          { signal: controller.signal, timeout: REQUEST_TIMEOUT_MS }
        );
        if (!isCurrent()) return;
        if (data?.error) {
          setFetchError(isValidChannel(channel) ? '采样数据为空' : '通道不存在');
        } else {
          const sample = parseSample(data, channel);
          if (sample) {
            // 原子提交，内部再次校验通道；波形/名称/脑状态保持一致
            applyLiveSample(channel, sample);
          } else {
            setFetchError('采样数据为空，等待恢复…');
          }
        }
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        if (!isCurrent()) return;
        if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
          setFetchError('采样超时，自动重试中…');
        } else if (axios.isAxiosError(err) && (err.response?.status === 404)) {
          setFetchError('通道不存在');
        } else {
          setFetchError('后端不可用，自动重试中…');
        }
        // 失败不写入任何数据：最后有效曲线保留，重试也不会重复同一段曲线
      } finally {
        // 已失效的请求（切通道/卸载/进回放）不再安排后续调度
        if (!cancelled && generation === generationRef.current) scheduleNext();
      }
    };

    void fetchEEG();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [selectedChannel, playbackMode, applyLiveSample, setFetchLoading, setFetchError]);

  // 实时模式只渲染归属当前通道的数据；回放模式使用录制帧数据
  const activeEeg = playbackMode || dataChannel === selectedChannel ? eegData : null;

  const chartData = activeEeg?.data[selectedChannel]?.map((v: number, i: number) => ({
    t: activeEeg.time[i]?.toFixed(3), value: Number(v.toFixed(4))
  })) || [];

  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '20px' }}>📈</span>
        <span>{selectedChannel}</span>
        <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{channelName} · 波形图</span>
        {isRecording && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d32f2f', animation: 'pulse 1s infinite' }} />
            录制中
          </span>
        )}
        {playbackMode && (
          <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放模式</span>
        )}
        {!playbackMode && <FetchStatusHint status={fetchStatus} error={fetchError} />}
      </h3>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
            <Line type="monotone" dataKey="value" stroke="#1565c0" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FetchStatusHint status={fetchStatus} error={fetchError} large />
        </div>
      )}
    </div>
  );
};

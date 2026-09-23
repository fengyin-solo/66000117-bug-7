import axios from 'axios';
import { EEGData, BandPower, BrainState, CorrelationData } from '../types';
import { ALL_CHANNELS } from '../constants';

export interface SampleResponse {
  channel: string;
  eeg: EEGData;
  bands: BandPower;
  brainState: BrainState;
  correlation: CorrelationData;
}

const REQUEST_TIMEOUT_MS = 8000;

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** 校验回包：通道一致、样本非空且数值合法。超时/空值/坏数据统一按失败处理，触发后续重试与恢复 */
export const validateSample = (data: any, expectedChannel: string): SampleResponse | null => {
  if (!data || typeof data !== 'object' || data.error) return null;
  if (data.channel !== expectedChannel) return null;
  const eeg = data.eeg as EEGData | undefined;
  if (!eeg || !Array.isArray(eeg.time) || !eeg.data || typeof eeg.data !== 'object') return null;
  const channelSeries = eeg.data[expectedChannel];
  if (!Array.isArray(channelSeries) || channelSeries.length === 0) return null;
  if (eeg.time.length !== channelSeries.length) return null;
  if (!channelSeries.some(isFiniteNumber)) return null;
  const bands = data.bands as BandPower | undefined;
  if (!bands || (['delta', 'theta', 'alpha', 'beta', 'gamma'] as const).some(k => !isFiniteNumber(bands[k]))) {
    return null;
  }
  const brainState = data.brainState as BrainState | undefined;
  if (!brainState || !isFiniteNumber(brainState.focus) || !brainState.status) return null;
  const correlation = data.correlation as CorrelationData | undefined;
  if (!correlation || correlation.targetChannel !== expectedChannel || !Array.isArray(correlation.correlations)) {
    return null;
  }
  if (!ALL_CHANNELS.includes(data.channel)) return null;
  return { channel: data.channel, eeg, bands, brainState, correlation };
};

export const fetchSample = async (channel: string, signal?: AbortSignal): Promise<SampleResponse> => {
  const response = await axios.get(`/api/eeg/sample/${channel}?duration=3`, {
    timeout: REQUEST_TIMEOUT_MS,
    signal,
  });
  const sample = validateSample(response.data, channel);
  if (!sample) throw new Error('采样数据为空或格式无效');
  return sample;
};

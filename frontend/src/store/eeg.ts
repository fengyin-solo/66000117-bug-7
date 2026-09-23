import { create } from 'zustand';
import { EEGData, BandPower, BrainState, CorrelationData, Recording, RecordingFrame, PlaybackState } from '../types';
import { ALL_CHANNELS } from '../constants';

const STORAGE_KEY = 'eeg_recordings';
const CHANNEL_STORAGE_KEY = 'eeg_selected_channel';

const loadRecordings = (): Recording[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecordings = (recordings: Recording[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
  } catch {}
};

const loadSelectedChannel = (): string => {
  try {
    const stored = localStorage.getItem(CHANNEL_STORAGE_KEY);
    if (stored && ALL_CHANNELS.includes(stored)) return stored;
  } catch {}
  return 'Fp1';
};

const saveSelectedChannel = (channel: string) => {
  try {
    localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
  } catch {}
};

export type StreamStatus = 'idle' | 'loading' | 'online' | 'error';

export interface StreamSample {
  channel: string;
  eeg: EEGData;
  bands: BandPower;
  brainState: BrainState;
  correlation: CorrelationData;
  timestamp: number;
}

interface EEGState {
  eegData: EEGData | null;
  selectedChannel: string;
  bandPower: BandPower | null;
  brainState: BrainState | null;
  correlationData: CorrelationData | null;
  streamStatus: StreamStatus;
  streamError: string | null;
  /** 当前实时数据所属通道；与 selectedChannel 不一致时数据视为失效，不得渲染到当前通道 */
  sampleChannel: string | null;
  isStreaming: boolean;
  isRecording: boolean;
  recordingStartTime: number;
  currentRecordingFrames: RecordingFrame[];
  recordings: Recording[];
  playbackMode: boolean;
  activeRecording: Recording | null;
  playbackState: PlaybackState;
  setChannel: (c: string) => void;
  setStreamLoading: () => void;
  applyStreamSample: (sample: StreamSample) => void;
  setStreamError: (message: string) => void;
  setStreaming: (v: boolean) => void;
  startRecording: () => void;
  stopRecording: (name: string) => void;
  addRecordingFrame: (eeg: EEGData, bands: BandPower, brainState: BrainState, correlation: CorrelationData) => void;
  deleteRecording: (id: string) => void;
  enterPlaybackMode: (recording: Recording) => void;
  exitPlaybackMode: () => void;
  setPlaybackTime: (time: number) => void;
  togglePlayback: () => void;
  setPlaybackPlaying: (playing: boolean) => void;
}

export const useEEGStore = create<EEGState>((set, get) => ({
  eegData: null,
  selectedChannel: loadSelectedChannel(),
  bandPower: null,
  brainState: null,
  correlationData: null,
  streamStatus: 'idle',
  streamError: null,
  sampleChannel: null,
  isStreaming: false,
  isRecording: false,
  recordingStartTime: 0,
  currentRecordingFrames: [],
  recordings: loadRecordings(),
  playbackMode: false,
  activeRecording: null,
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    currentFrame: null,
  },
  setChannel: (c) => {
    if (!ALL_CHANNELS.includes(c)) return;
    const { selectedChannel, playbackMode } = get();
    if (playbackMode || c === selectedChannel) return;
    saveSelectedChannel(c);
    // 立即丢弃上一通道的全部结果，避免残波和旧信号状态残留；
    // 旧请求即使晚到也会因通道不匹配而被 applyStreamSample 拒绝
    set({
      selectedChannel: c,
      eegData: null,
      bandPower: null,
      brainState: null,
      correlationData: null,
      sampleChannel: null,
      streamStatus: 'loading',
      streamError: null,
    });
  },
  setStreamLoading: () => {
    if (get().playbackMode) return;
    set({ streamStatus: 'loading', streamError: null });
  },
  applyStreamSample: (sample) => {
    const state = get();
    if (state.playbackMode) return;
    // 只接受当前通道的结果，慢请求/重试的陈旧回包一律丢弃
    if (sample.channel !== state.selectedChannel) return;
    set({
      selectedChannel: sample.channel,
      eegData: sample.eeg,
      bandPower: sample.bands,
      brainState: sample.brainState,
      correlationData: sample.correlation,
      sampleChannel: sample.channel,
      streamStatus: 'online',
      streamError: null,
    });
    if (state.isRecording) {
      get().addRecordingFrame(sample.eeg, sample.bands, sample.brainState, sample.correlation);
    }
  },
  setStreamError: (message) => {
    if (get().playbackMode) return;
    // 不清空已有的有效数据：采样超时/空值恢复后可继续展示，波形与状态始终属于同一通道
    set({ streamStatus: 'error', streamError: message });
  },
  setStreaming: (v) => set({ isStreaming: v }),
  startRecording: () => {
    set({
      isRecording: true,
      recordingStartTime: Date.now(),
      currentRecordingFrames: [],
      playbackMode: false,
      activeRecording: null,
    });
  },
  stopRecording: (name: string) => {
    const { currentRecordingFrames, recordingStartTime, selectedChannel } = get();
    if (currentRecordingFrames.length === 0) {
      set({ isRecording: false, currentRecordingFrames: [] });
      return;
    }
    const endTime = Date.now();
    const duration = (endTime - recordingStartTime) / 1000;
    const newRecording: Recording = {
      id: `rec_${endTime}`,
      name: name || `录制 ${new Date(recordingStartTime).toLocaleString()}`,
      channel: selectedChannel,
      startTime: recordingStartTime,
      endTime,
      duration,
      frames: currentRecordingFrames,
    };
    const recordings = [...get().recordings, newRecording];
    saveRecordings(recordings);
    set({
      isRecording: false,
      recordingStartTime: 0,
      currentRecordingFrames: [],
      recordings,
    });
  },
  addRecordingFrame: (eeg, bands, brainState, correlation) => {
    const { isRecording, recordingStartTime, currentRecordingFrames } = get();
    if (!isRecording) return;
    const relativeTime = (Date.now() - recordingStartTime) / 1000;
    const frame: RecordingFrame = { relativeTime, eeg, bands, brainState, correlation };
    set({ currentRecordingFrames: [...currentRecordingFrames, frame] });
  },
  deleteRecording: (id) => {
    const recordings = get().recordings.filter(r => r.id !== id);
    saveRecordings(recordings);
    const { activeRecording } = get();
    if (activeRecording?.id === id) {
      set({ recordings, playbackMode: false, activeRecording: null });
    } else {
      set({ recordings });
    }
  },
  enterPlaybackMode: (recording) => {
    if (recording.frames.length === 0) return;
    // 回放期间选择器、波形名称、信号状态统一到录制通道
    saveSelectedChannel(recording.channel);
    set({
      playbackMode: true,
      activeRecording: recording,
      selectedChannel: recording.channel,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: recording.frames[0],
      },
      eegData: recording.frames[0].eeg,
      bandPower: recording.frames[0].bands,
      brainState: recording.frames[0].brainState,
      correlationData: recording.frames[0].correlation,
      sampleChannel: recording.channel,
      streamStatus: 'idle',
      streamError: null,
    });
  },
  exitPlaybackMode: () => {
    const channel = get().selectedChannel;
    // 退出回放后实时数据尚未回来，先清空录制帧并进入加载态，避免旧录制数据被当作实时结果
    set({
      playbackMode: false,
      activeRecording: null,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: null,
      },
      eegData: null,
      bandPower: null,
      brainState: null,
      correlationData: null,
      sampleChannel: null,
      streamStatus: 'loading',
      streamError: null,
    });
    saveSelectedChannel(channel);
  },
  setPlaybackTime: (time) => {
    const { activeRecording } = get();
    if (!activeRecording || activeRecording.frames.length === 0) return;
    const frames = activeRecording.frames;
    let frameIndex = 0;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].relativeTime <= time) {
        frameIndex = i;
      } else {
        break;
      }
    }
    const frame = frames[frameIndex];
    set({
      playbackState: {
        ...get().playbackState,
        currentTime: time,
        currentFrame: frame,
      },
      eegData: frame.eeg,
      bandPower: frame.bands,
      brainState: frame.brainState,
      correlationData: frame.correlation,
      sampleChannel: activeRecording.channel,
    });
  },
  togglePlayback: () => {
    const { playbackState } = get();
    set({
      playbackState: {
        ...playbackState,
        isPlaying: !playbackState.isPlaying,
      },
    });
  },
  setPlaybackPlaying: (playing) => {
    set({
      playbackState: {
        ...get().playbackState,
        isPlaying: playing,
      },
    });
  },
}));

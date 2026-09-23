import { create } from 'zustand';
import { EEGData, BandPower, BrainState, CorrelationData, Recording, RecordingFrame, PlaybackState } from '../types';

const STORAGE_KEY = 'eeg_recordings';
const CHANNEL_KEY = 'eeg_selected_channel';

const CHANNELS = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2'];

export const isValidChannel = (ch: unknown): ch is string =>
  typeof ch === 'string' && CHANNELS.includes(ch);

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
    const stored = localStorage.getItem(CHANNEL_KEY);
    if (isValidChannel(stored)) return stored;
  } catch {}
  return 'Fp1';
};

const persistSelectedChannel = (channel: string) => {
  try {
    localStorage.setItem(CHANNEL_KEY, channel);
  } catch {}
};

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface LiveSample {
  eeg: EEGData;
  bands: BandPower;
  brainState: BrainState;
  correlation: CorrelationData;
}

interface EEGState {
  eegData: EEGData | null;
  selectedChannel: string;
  // 实时数据所属通道：实时模式下只有与 selectedChannel 一致的数据才允许渲染，
  // 防止慢请求回包把旧通道结果写到当前通道
  dataChannel: string | null;
  // 最近一次实时采样的请求状态与错误信息，供各面板展示失败/恢复状态
  fetchStatus: FetchStatus;
  fetchError: string | null;
  bandPower: BandPower | null;
  isStreaming: boolean;
  brainState: BrainState | null;
  correlationData: CorrelationData | null;
  isRecording: boolean;
  recordingStartTime: number;
  currentRecordingFrames: RecordingFrame[];
  recordings: Recording[];
  playbackMode: boolean;
  activeRecording: Recording | null;
  playbackState: PlaybackState;
  setEEGData: (d: EEGData | null) => void;
  setChannel: (c: string) => void;
  setBandPower: (b: BandPower | null) => void;
  setStreaming: (v: boolean) => void;
  setBrainState: (s: BrainState | null) => void;
  setCorrelationData: (c: CorrelationData | null) => void;
  // 原子提交某通道的一次有效采样；通道已切换则丢弃，保证四组数据同属一个通道
  applyLiveSample: (channel: string, sample: LiveSample) => void;
  setFetchLoading: () => void;
  setFetchError: (message: string) => void;
  // 清空实时数据（切换通道 / 退出回放时调用）
  resetLiveData: () => void;
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
  dataChannel: null,
  fetchStatus: 'idle',
  fetchError: null,
  bandPower: null,
  isStreaming: false,
  brainState: null,
  correlationData: null,
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
  setEEGData: (d) => set({ eegData: d }),
  setChannel: (c) => {
    if (!isValidChannel(c) || c === get().selectedChannel) return;
    persistSelectedChannel(c);
    if (get().playbackMode) {
      // 回放数据来自录制帧，切通道不影响回放内容
      set({ selectedChannel: c });
      return;
    }
    // 清空上一通道残留，标记加载中；旧请求回包时会在 applyLiveSample 被丢弃
    set({
      selectedChannel: c,
      dataChannel: null,
      fetchStatus: 'loading',
      fetchError: null,
      eegData: null,
      bandPower: null,
      brainState: null,
      correlationData: null,
    });
  },
  setBandPower: (b) => set({ bandPower: b }),
  setStreaming: (v) => set({ isStreaming: v }),
  setBrainState: (s) => set({ brainState: s }),
  setCorrelationData: (c) => set({ correlationData: c }),
  applyLiveSample: (channel, sample) => {
    // 通道已切换或进入回放：失效请求一律丢弃，不能影响当前通道
    if (get().playbackMode || channel !== get().selectedChannel) return;
    set({
      dataChannel: channel,
      eegData: sample.eeg,
      bandPower: sample.bands,
      brainState: sample.brainState,
      correlationData: sample.correlation,
      fetchStatus: 'success',
      fetchError: null,
    });
    if (get().isRecording) {
      get().addRecordingFrame(sample.eeg, sample.bands, sample.brainState, sample.correlation);
    }
  },
  setFetchLoading: () => {
    if (get().playbackMode) return;
    set({ fetchStatus: 'loading', fetchError: null });
  },
  setFetchError: (message) => {
    if (get().playbackMode) return;
    // 失败不清空最后有效数据，只更新状态；下次成功采样自动恢复
    set({ fetchStatus: 'error', fetchError: message });
  },
  resetLiveData: () => set({
    dataChannel: null,
    fetchStatus: 'loading',
    fetchError: null,
    eegData: null,
    bandPower: null,
    brainState: null,
    correlationData: null,
  }),
  startRecording: () => {
    const { selectedChannel } = get();
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
    set({
      playbackMode: true,
      activeRecording: recording,
      dataChannel: null,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: recording.frames[0],
      },
      eegData: recording.frames[0].eeg,
      bandPower: recording.frames[0].bands,
      brainState: recording.frames[0].brainState,
      correlationData: recording.frames[0].correlation,
    });
  },
  exitPlaybackMode: () => {
    set({
      playbackMode: false,
      activeRecording: null,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: null,
      },
    });
    // 清空回放帧，WaveformChart 监听到退出回放后会重新拉取当前通道实时数据
    get().resetLiveData();
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

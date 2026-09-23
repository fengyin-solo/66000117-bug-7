import { useEEGStore } from '../store/eeg';
import { EEGData } from '../types';

/**
 * 返回当前通道可安全渲染的实时/回放 EEG 数据。
 * 若现存数据属于其它通道（慢请求残留、切换瞬间），返回 null，
 * 保证波形、通道名称、频段与信号状态始终指向同一通道。
 */
export const useActiveEEGData = (): EEGData | null =>
  useEEGStore((s) => {
    if (!s.eegData) return null;
    if (s.playbackMode) return s.eegData;
    return s.sampleChannel === s.selectedChannel ? s.eegData : null;
  });

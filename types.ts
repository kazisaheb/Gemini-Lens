
export interface SubPreset {
  id: string;
  label: string;
  prompt: string;
}

export interface EditingPreset {
  id: string;
  label: string;
  icon: string;
  subPresets: SubPreset[];
}

export interface HistoryItem {
  id: string;
  original: string;
  edited: string;
  prompt: string;
  timestamp: number;
}

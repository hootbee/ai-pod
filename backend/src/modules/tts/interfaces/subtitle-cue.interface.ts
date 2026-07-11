export interface SubtitleCue {
  index: number;
  text: string;
  startMs: number;
  endMs: number;
  isTopicChange: boolean;
}

export interface SubtitleCueDocument {
  version: 1;
  cues: SubtitleCue[];
}

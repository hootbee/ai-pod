export interface ScriptSegment {
  speaker: 'speaker1' | 'speaker2';
  text: string;
  isTopicChange?: boolean; // true면 이 세그먼트 앞에 1.2s 주제전환 공백 삽입
}

export interface PodcastScript {
  title: string;
  script: string;           // 전체 대본 (TTS 청크 처리용 원본)
  segments?: ScriptSegment[]; // 화자별 분리된 세그먼트
}

export interface BriefingArticle {
  title: string;
  content: string;
  source?: string;
}

export interface AiProvider {
  generatePodcastScript(newsContent: string): Promise<PodcastScript>;
  generateBriefingScript(articles: BriefingArticle[]): Promise<PodcastScript>;
}

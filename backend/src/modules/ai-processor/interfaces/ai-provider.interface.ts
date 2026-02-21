export interface PodcastScript {
  title: string;
  script: string;
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

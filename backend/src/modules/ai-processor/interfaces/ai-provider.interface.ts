export interface PodcastScript {
  title: string;
  script: string;
}

export interface AiProvider {
  generatePodcastScript(newsContent: string): Promise<PodcastScript>;
}

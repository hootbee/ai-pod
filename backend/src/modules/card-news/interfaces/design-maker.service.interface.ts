import type { CardSlide } from './director.service.interface';

export interface IDesignMakerService {
  generateHtml(slide: CardSlide, theme: 'dark' | 'light', imageUrl?: string | null): Promise<string>;
}

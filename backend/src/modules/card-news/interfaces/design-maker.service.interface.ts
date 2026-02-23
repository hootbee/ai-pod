import type { DesignDirection } from './director.service.interface';

export interface IDesignMakerService {
  generateHtml(direction: DesignDirection): Promise<string>;
}

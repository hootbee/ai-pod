import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AppVersionPolicy = {
  latestVersion: string;
  minimumVersion: string;
  latestBuildNumber: number;
  minimumBuildNumber: number;
  forceUpdate: boolean;
  storeUrl: string;
};

@Injectable()
export class AppVersionService {
  constructor(private readonly configService: ConfigService) {}

  getPolicy(): AppVersionPolicy {
    return {
      latestVersion: this.configService.get('APP_LATEST_VERSION', '1.0.8'),
      minimumVersion: this.configService.get('APP_MINIMUM_VERSION', '1.0.0'),
      latestBuildNumber: this.getNumber('APP_LATEST_BUILD_NUMBER', 9),
      minimumBuildNumber: this.getNumber('APP_MINIMUM_BUILD_NUMBER', 1),
      forceUpdate: this.configService.get('APP_FORCE_UPDATE', 'false') === 'true',
      storeUrl: this.configService.get(
        'APP_STORE_URL',
        'https://play.google.com/store/apps/details?id=com.aipod.app',
      ),
    };
  }

  private getNumber(key: string, fallback: number): number {
    const value = Number(this.configService.get(key, fallback));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }
}

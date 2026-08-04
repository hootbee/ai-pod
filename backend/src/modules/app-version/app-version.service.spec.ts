import { ConfigService } from '@nestjs/config';
import { AppVersionService } from './app-version.service';

describe('AppVersionService', () => {
  it('환경변수 기반 버전 정책을 반환한다', () => {
    const config = new ConfigService({
      APP_LATEST_VERSION: '1.0.9',
      APP_MINIMUM_VERSION: '1.0.8',
      APP_LATEST_BUILD_NUMBER: '10',
      APP_MINIMUM_BUILD_NUMBER: '9',
      APP_FORCE_UPDATE: 'true',
      APP_STORE_URL: 'https://play.google.com/store/apps/details?id=test',
    });

    expect(new AppVersionService(config).getPolicy()).toEqual({
      latestVersion: '1.0.9',
      minimumVersion: '1.0.8',
      latestBuildNumber: 10,
      minimumBuildNumber: 9,
      forceUpdate: true,
      storeUrl: 'https://play.google.com/store/apps/details?id=test',
    });
  });

  it('잘못된 숫자 설정은 기본값으로 대체한다', () => {
    const config = new ConfigService({
      APP_LATEST_BUILD_NUMBER: '-1',
      APP_MINIMUM_BUILD_NUMBER: 'invalid',
    });

    expect(new AppVersionService(config).getPolicy()).toMatchObject({
      latestBuildNumber: 9,
      minimumBuildNumber: 1,
    });
  });
});

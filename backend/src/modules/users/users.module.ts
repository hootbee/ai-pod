import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EpisodesModule } from '../episodes/episodes.module';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { AuthAuditLog } from '../auth/entities/auth-audit-log.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { EpisodePlayLog } from '../episodes/entities/episode-play-log.entity';
import { CardNewsViewLog } from '../card-news/entities/card-news-view-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      AuthAuditLog,
      AnalyticsEvent,
      EpisodePlayLog,
      CardNewsViewLog,
    ]),
    EpisodesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

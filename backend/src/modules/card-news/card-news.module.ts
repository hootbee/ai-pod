import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardNews } from './entities/card-news.entity';
import { CardNewsController } from './card-news.controller';
import { CardNewsService } from './card-news.service';
import { DirectorService } from './director.service';
import { DesignMakerService } from './design-maker.service';
import { RendererService } from './renderer.service';
import { EpisodesModule } from '../episodes/episodes.module';

@Module({
  imports: [TypeOrmModule.forFeature([CardNews]), EpisodesModule],
  controllers: [CardNewsController],
  providers: [CardNewsService, DirectorService, DesignMakerService, RendererService],
})
export class CardNewsModule {}

import { Module } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { RankingModule } from '../ranking/ranking.module';

@Module({
  imports: [RankingModule],
  controllers: [SearchController],
  providers: [ElasticsearchService, SearchService],
  exports: [SearchService],
})
export class SearchModule {}

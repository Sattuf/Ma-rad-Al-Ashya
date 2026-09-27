import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresConnectionOptions } from './common/database';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { CategoriesModule } from './categories/categories.module';
import { Listing } from './listings/entities/listing.entity';
import { ListingImage } from './listings/entities/listing-image.entity';
import { Category } from './categories/entities/category.entity';
import { Promotion } from './promotions/entities/promotion.entity';
import { PromotionsModule } from './promotions/promotions.module';

import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        ...postgresConnectionOptions(),
        entities: [Listing, ListingImage, Category, Promotion],
      }),
    }),
    AuthModule,
    ListingsModule,
    CategoriesModule,
    PromotionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


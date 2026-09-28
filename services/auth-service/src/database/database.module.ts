import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresConnectionOptions } from '../common/database';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...postgresConnectionOptions(),
        entities: [User],
        logging: configService.get<string>('NODE_ENV', 'development') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}

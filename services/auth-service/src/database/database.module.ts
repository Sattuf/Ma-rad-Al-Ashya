import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'marad_user'),
        password: configService.get<string>('DATABASE_PASSWORD', 'marad_dev_password'),
        database: configService.get<string>('DATABASE_NAME', 'marad_db'),
        entities: [User],
        synchronize: false, // We use migrations manually or handle via SQL scripts in dev
        logging: configService.get<string>('NODE_ENV', 'development') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}

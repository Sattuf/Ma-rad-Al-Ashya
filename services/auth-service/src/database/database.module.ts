import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresConnectionOptions } from '../common/database';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...postgresConnectionOptions(),
        entities: [User],
      }),
    }),
  ],
})
export class DatabaseModule {}

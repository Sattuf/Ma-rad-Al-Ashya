import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagingModule } from './messaging/messaging.module';

import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/marad_messaging',
      { maxPoolSize: parseInt(process.env.MONGO_POOL_MAX || '20', 10), serverSelectionTimeoutMS: 5000 },
    ),
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


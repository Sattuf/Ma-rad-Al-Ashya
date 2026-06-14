import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagingModule } from './messaging/messaging.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/messaging'),
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


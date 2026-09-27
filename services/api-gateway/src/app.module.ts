import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProxyModule } from './proxy/proxy.module';
import configuration from './config/configuration';

import { PrometheusModule } from '@willsoto/nestjs-prometheus';

const isAuthRoute = (path: string) => path.startsWith('/api/v1/auth');

@Module({
  imports: [
    PrometheusModule.register(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '300', 10),
      },
      {
        // Stricter limit for credential endpoints only. Named throttlers apply to every
        // route unless skipped, which previously capped the whole API at 5 req/min.
        name: 'auth',
        ttl: 60_000,
        limit: parseInt(process.env.AUTH_RATE_LIMIT_PER_MINUTE || '20', 10),
        skipIf: (context) => !isAuthRoute(context.switchToHttp().getRequest().path ?? ''),
      },
    ]),
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

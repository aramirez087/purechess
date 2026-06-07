import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { RatingsModule } from './ratings/ratings.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { RealtimeModule } from './realtime/realtime.module';
import { InvitesModule } from './invites/invites.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MetricsModule } from './metrics/metrics.module';
import { RedisModule } from './redis/redis.module';
import { TestingModule } from './testing/testing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): Record<string, unknown> => ({
        pinoHttp: {
          level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          transport:
            config.get('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty' }
              : undefined,
          redact: [
            'req.headers.cookie',
            'req.headers.authorization',
            'req.body.password',
            'req.body.token',
          ],
          genReqId: (req: IncomingMessage) =>
            (req.headers['x-request-id'] as string) ?? randomUUID(),
          customProps: (req: IncomingMessage & { id?: string }) => ({
            requestId: req.id,
          }),
        },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    GamesModule,
    MatchmakingModule,
    RatingsModule,
    ReportsModule,
    AdminModule,
    RealtimeModule,
    InvitesModule,
    AnalyticsModule,
    MetricsModule,
    RedisModule,
    ...(process.env['NODE_ENV'] === 'test' ? [TestingModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

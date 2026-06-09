import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';
import {
  ENGINE_BACKEND,
  ENGINE_ADAPTER,
  getEngineBackend,
  nativeAvailable,
} from '../config/engine-backend.config';
import { TsEngineAdapter } from './engine/ts-adapter';
import { NativeEngineAdapter } from './engine/native-adapter';
import { ShadowAdapter } from './engine/shadow-adapter';
import { Sentry } from '../observability/sentry';

@Module({
  providers: [
    EngineService,
    {
      provide: ENGINE_BACKEND,
      useFactory: () => getEngineBackend(),
    },
    {
      provide: ENGINE_ADAPTER,
      useFactory: (backendHint: 'native' | 'ts' | 'shadow-ts' | null) => {
        const backend = backendHint ?? (process.env.NODE_ENV === 'production' ? 'native' : 'ts');

        let adapter;
        if (process.env.ENGINE_SHADOW === '1' && nativeAvailable) {
          adapter = new ShadowAdapter(new TsEngineAdapter(), new NativeEngineAdapter());
        } else if (backend === 'native' && nativeAvailable) {
          adapter = new NativeEngineAdapter();
        } else {
          adapter = new TsEngineAdapter();
        }

        try {
          Sentry.addBreadcrumb({ category: 'engine', message: `engine booted: ${adapter.name()}` });
        } catch {
          // Sentry not initialized (dev/test) — silently no-op
        }

        return adapter;
      },
      inject: [ENGINE_BACKEND],
    },
  ],
  exports: [EngineService],
})
export class ChessEngineModule {}

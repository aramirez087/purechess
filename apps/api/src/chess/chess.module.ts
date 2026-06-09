import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';
import { ENGINE_BACKEND, ENGINE_ADAPTER, nativeAvailable } from '../config/engine-backend.config';
import { TsEngineAdapter } from './engine/ts-adapter';
import { NativeEngineAdapter } from './engine/native-adapter';

@Module({
  providers: [
    EngineService,
    {
      provide: ENGINE_BACKEND,
      useValue: process.env.ENGINE_BACKEND ?? 'ts',
    },
    {
      provide: ENGINE_ADAPTER,
      useFactory: (backend: string) => {
        if (backend === 'native' && nativeAvailable) {
          return new NativeEngineAdapter();
        }
        return new TsEngineAdapter();
      },
      inject: [ENGINE_BACKEND],
    },
  ],
  exports: [EngineService],
})
export class ChessEngineModule {}

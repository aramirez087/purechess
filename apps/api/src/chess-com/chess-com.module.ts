import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChessComController } from './chess-com.controller';
import { ChessComService } from './chess-com.service';

@Module({
  imports: [AuthModule],
  controllers: [ChessComController],
  providers: [ChessComService],
  exports: [ChessComService],
})
export class ChessComModule {}
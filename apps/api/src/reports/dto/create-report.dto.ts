import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsString()
  reportedUserId!: string;

  @IsOptional()
  @IsString()
  gameId?: string;

  @IsIn(['cheating', 'abuse', 'stalking', 'multi_account', 'other'])
  reason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

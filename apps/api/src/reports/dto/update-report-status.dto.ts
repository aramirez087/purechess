import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateReportStatusDto {
  @IsIn(['reviewed', 'dismissed'])
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

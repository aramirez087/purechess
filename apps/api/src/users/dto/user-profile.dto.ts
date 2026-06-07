import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,18}[a-zA-Z0-9]$/, {
    message: 'Username must be 3-20 chars, alphanumeric with _ or -, no leading/trailing separators',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string | null;
}

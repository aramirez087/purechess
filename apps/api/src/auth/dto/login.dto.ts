import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
  })
  emailOrUsername!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
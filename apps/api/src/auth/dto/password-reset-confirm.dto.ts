import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../password-rules';

export class PasswordResetConfirmDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}
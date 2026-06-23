import { IsNotEmpty, IsString } from 'class-validator';

export class EmailVerificationConfirmDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
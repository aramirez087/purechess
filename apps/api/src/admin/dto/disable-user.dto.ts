import { IsNotEmpty, IsString } from 'class-validator';

export class DisableUserDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

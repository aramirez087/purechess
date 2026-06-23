import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { isReservedUsername } from '../reserved-usernames';
import { IsStrongPassword } from '../password-rules';

function IsNotReservedUsername(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotReservedUsername',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return !isReservedUsername(value);
        },
        defaultMessage() {
          return 'Username is reserved';
        },
      },
    });
  };
}

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,18}[a-zA-Z0-9]$/, {
    message:
      'Username must be 3-20 chars, alphanumeric with _ or -, no leading/trailing separators',
  })
  @IsNotReservedUsername({ message: 'Username is reserved' })
  username!: string;

  @IsString()
  @IsStrongPassword()
  password!: string;
}
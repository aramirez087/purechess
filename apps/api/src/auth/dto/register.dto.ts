import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const RESERVED_USERNAMES = new Set([
  'admin', 'purechess', 'system', 'root', 'support', 'help', 'api', 'www', 'mail', 'info',
  'moderator', 'mod', 'staff', 'bot', 'null', 'undefined',
]);

function IsNotReservedUsername(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotReservedUsername',
      target: (object as { constructor: new (...args: unknown[]) => unknown }).constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return !RESERVED_USERNAMES.has(value.toLowerCase());
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
  email!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,18}[a-zA-Z0-9]$/, {
    message: 'Username must be 3-20 chars, alphanumeric with _ or -, no leading/trailing separators',
  })
  @IsNotReservedUsername({ message: 'Username is reserved' })
  username!: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*[0-9])/, {
    message: 'Password must contain at least one uppercase letter and one number',
  })
  password!: string;
}

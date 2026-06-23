import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = /(?=.*[A-Z])(?=.*[0-9])/;
export const PASSWORD_PATTERN_MESSAGE =
  'Password must contain at least one uppercase letter and one number';

export function IsStrongPassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return (
            value.length >= PASSWORD_MIN_LENGTH && PASSWORD_PATTERN.test(value)
          );
        },
        defaultMessage() {
          return PASSWORD_PATTERN_MESSAGE;
        },
      },
    });
  };
}
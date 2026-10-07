import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * Cross-field flag check: this property and `property` cannot both be `true`
 * (e.g. `isDefault` and `archive`). Built on class-validator's `ValidateBy`.
 */
export function IsExclusiveWith(property: string, validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isExclusiveWith',
      constraints: [property],
      validator: {
        validate: (value: unknown, args) =>
          !(value === true && (args?.object as Record<string, unknown>)[property] === true),
        defaultMessage: (args) => `${args?.property} and ${property} cannot both be true`,
      },
    },
    validationOptions,
  );
}

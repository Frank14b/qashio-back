import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * Cross-field date check: this date must be the same as or after `property`.
 * class-validator only ships fixed-bound date checks (`MinDate`), so this
 * builds on its `ValidateBy` helper. Passes when either side is missing or
 * not a valid date — pair with `@IsOptional()` / `@IsDateString()` for those.
 */
export function IsNotBefore(property: string, validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isNotBefore',
      constraints: [property],
      validator: {
        validate: (value: unknown, args) => {
          const other = (args?.object as Record<string, unknown>)[property];
          const end = Date.parse(String(value));
          const start = Date.parse(String(other));
          if (value == null || other == null || Number.isNaN(end) || Number.isNaN(start)) {
            return true;
          }
          return end >= start;
        },
        defaultMessage: (args) => `${args?.property} must not be before ${property}`,
      },
    },
    validationOptions,
  );
}

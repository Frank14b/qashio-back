import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Class decorator for PATCH/PUT bodies: at least one of `properties` must be
 * present (not `undefined`). class-validator only validates per property, and
 * optional properties skip validation when missing, so the rule is registered
 * on a dedicated pseudo-property that is always checked.
 */
export function RequireAtLeastOne(properties: string[], validationOptions?: ValidationOptions) {
  return (target: abstract new (...args: never[]) => object) => {
    registerDecorator({
      name: 'requireAtLeastOne',
      target,
      propertyName: 'body',
      constraints: [properties],
      options: {
        message: `Provide at least one of: ${properties.join(', ')}`,
        ...validationOptions,
      },
      validator: {
        validate: (_value: unknown, args) => {
          const object = args?.object as Record<string, unknown>;
          return properties.some((property) => object[property] !== undefined);
        },
      },
    });
  };
}

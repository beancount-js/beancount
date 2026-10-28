import { clsx, type ClassValue } from "clsx";

type VariantValue = PropertyKey | boolean | null | undefined;
type VariantOptions = Record<string, Record<string, ClassValue>>;

type VariantSelection<TVariants extends VariantOptions> = {
  [TKey in keyof TVariants]?: keyof TVariants[TKey] | boolean | null;
};

type VariantConfig<TVariants extends VariantOptions> = {
  base?: ClassValue;
  variants?: TVariants;
  defaultVariants?: VariantSelection<TVariants>;
};

type VariantFunction<TVariants extends VariantOptions> = (
  props?: VariantSelection<TVariants> & {
    class?: ClassValue;
    className?: ClassValue;
  },
) => string;

function variantKey(value: VariantValue): string {
  return String(value);
}

export function createVariants<
  const TVariants extends VariantOptions = VariantOptions,
>(config: VariantConfig<TVariants>): VariantFunction<TVariants> {
  return (props = {}) => {
    const classes: ClassValue[] = [config.base];

    for (const [name, values] of Object.entries(config.variants ?? {})) {
      const selected =
        props[name as keyof typeof props] ??
        config.defaultVariants?.[name as keyof TVariants];

      if (selected !== null && selected !== undefined) {
        classes.push(values[variantKey(selected)]);
      }
    }

    classes.push(props.class, props.className);
    return clsx(classes);
  };
}

export type VariantProps<
  TVariantFunction extends (...args: never[]) => string,
> = NonNullable<Parameters<TVariantFunction>[0]>;

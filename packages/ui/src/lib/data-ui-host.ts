const DATA_UI_COMPONENT_KEY = "data-ui-component";
const DATA_UI_PART_KEY = "data-ui-part";

export type DataUiRestProps = Record<string, unknown>;

export function omitDataUiComponent<T extends DataUiRestProps>(
  rest: T,
): Omit<T, "data-ui-component" | "dataUiComponent"> {
  const {
    [DATA_UI_COMPONENT_KEY]: _attribute,
    dataUiComponent: _property,
    ...safe
  } = rest as T & {
    "data-ui-component"?: unknown;
    dataUiComponent?: unknown;
  };
  return safe;
}

export function omitDataUiIdentity<T extends DataUiRestProps>(
  rest: T,
): Omit<
  T,
  "data-ui-component" | "data-ui-part" | "dataUiComponent" | "dataUiPart"
> {
  const {
    [DATA_UI_COMPONENT_KEY]: _componentAttribute,
    [DATA_UI_PART_KEY]: _partAttribute,
    dataUiComponent: _componentProperty,
    dataUiPart: _partProperty,
    ...safe
  } = rest as T & {
    "data-ui-component"?: unknown;
    "data-ui-part"?: unknown;
    dataUiComponent?: unknown;
    dataUiPart?: unknown;
  };
  return safe;
}

export function resolveDataUiComponent(
  defaultComponent: string,
  dataUiComponent?: string | null,
): string {
  return dataUiComponent && dataUiComponent.length > 0
    ? dataUiComponent
    : defaultComponent;
}

export function resolveDataUiPart(
  defaultPart: string,
  dataUiPart?: string | null,
): string {
  return dataUiPart && dataUiPart.length > 0 ? dataUiPart : defaultPart;
}

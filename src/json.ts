// copied over from type-fest to avoid build issue
/**
 * @public
 */
export type JsonObject = {[Key in string]: JsonValue} & {[Key in string]?: JsonValue | undefined}

/**
 * @public
 */
export type JsonArray = JsonValue[] | readonly JsonValue[]

/**
 * @public
 */
export type JsonPrimitive = boolean | number | string | null

/**
 * @public
 */
export type JsonValue = JsonArray | JsonObject | JsonPrimitive

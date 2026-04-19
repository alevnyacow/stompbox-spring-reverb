import { ZodObject } from "zod"

export type ParametersMapping<InputSchema extends ZodObject> = {
    [k in keyof InputSchema['shape']]: 'body' | 'query' | {
        source: 'body' | 'query',
        customSchema: InputSchema['shape'][k]
    }
}

import { NextRequest, NextResponse } from 'next/server'
import z, { ZodObject, ZodType } from 'zod'
import { Adapter } from './handler'

export type ParametersMapping<InputSchema extends ZodObject> = {
    [k in keyof InputSchema['shape']]: 'body' | 'query' | {
        source: 'body' | 'query',
        customSchema: InputSchema['shape'][k]
    }
}

export const nextAdapter = <InputSchema extends ZodObject, OutputSchema extends ZodObject>(HandlerClass: { inputSchema: InputSchema, outputSchema: OutputSchema } )=> {
    return (parametersMapping: ParametersMapping<InputSchema>): Adapter<NextRequest, NextResponse, InputSchema, OutputSchema>  => {
        const inputFromNextRequest = async (request: NextRequest): Promise<z.infer<InputSchema>> => {
            let input: Record<string, any> = {}

            const queryParameters = Object.entries(parametersMapping)
                .filter(([, x]) => x === 'query' || x.source === 'query') as [string, 'query' | { customSchema: ZodType }][] 

            if (queryParameters.length) {
                const queryParamsAsObject = Object.fromEntries(
                    request.nextUrl.searchParams.entries()
                );

                let schema: ZodObject = z.object({})

                for (const entry of queryParameters) {
                    const [field, rule] = entry
                    if (rule === 'query') {
                        // @ts-expect-error
                        schema.extend(HandlerClass.inputSchema.pick({ [field]: true }).shape)
                    }
                    if (typeof rule === 'object' && rule && 'customSchema' in rule) {
                        schema.extend({ [field]: rule.customSchema })
                    }
                }

                const queryParamsParsed = schema.safeParse(queryParamsAsObject);
                input = { ...input, ...queryParamsParsed }
            }

            const bodyEntries = Object.entries(
                parametersMapping
            ).filter(([, x]) => x === 'body' || x.source === 'body') as [string, 'body' | { customSchema: ZodType }][]

            if (bodyEntries.length) {
                let schema = z.object({})
                const body = await request.json();
                for (const bodyEntry of bodyEntries) {
                    const [field, rule] = bodyEntry
                    if (rule === 'body') {
                        // @ts-expect-error
                        schema.extend(HandlerClass.inputSchema.pick({ [field]: true }).shape)
                    }
                    if (typeof rule === 'object' && rule && 'customSchema' in rule) {
                        schema.extend({ [field]: rule.customSchema })
                    }
                }
                const bodyParsed = schema.parse(body)
                input = {...input, ...bodyParsed}
            }

            return input as z.infer<InputSchema>
        }

        const outputToNextRequest = async (output: z.infer<OutputSchema>): Promise<NextResponse> => {
            return NextResponse.json(output)
        }

        return {
            input: inputFromNextRequest,
            output: outputToNextRequest
        }
    }
}


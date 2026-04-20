import { NextRequest, NextResponse } from 'next/server'
import z, { ZodObject, ZodType } from 'zod'
import { Adapter } from './handler'
import { Limiter, enrichDetails } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'
import { ParametersMapping } from './api-adapter-types'

const nextAdapterDefaultErrors = {
    INVALID_QUERY_PARAMS: 'SPRING-REVERB___NEXT-ADAPTER-INVALID-QUERY-PARAMS',
    INVALID_BODY_PAYLOAD: 'SPRING-REVERB___NEXT-ADAPTER-INVALID-BODY-PAYLOAD',
}

const nextAdapterErrors = {
    NOT_FOUND: 'SPRING-REVERB___NEXT-ADAPTER-NOT-FOUND'
}

export class NextAdapterError extends Limiter({ 
    ...nextAdapterDefaultErrors, 
    ...nextAdapterErrors 
}) { }


export const nextAdapter = <InputSchema extends ZodObject, OutputSchema extends ZodObject>(HandlerClass: { inputSchema: InputSchema, outputSchema: OutputSchema, sourceForErrorDetails?: string })=> {
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
                        schema = schema.extend(HandlerClass.inputSchema.pick({ [field]: true }).shape)
                    }
                    if (typeof rule === 'object' && rule && 'customSchema' in rule) {
                        schema = schema.extend({ [field]: rule.customSchema })
                    }
                }

                const queryParamsParsed = schema.safeParse(queryParamsAsObject);

                if (!queryParamsParsed.success) {
                    throw new NextAdapterError('INVALID_QUERY_PARAMS', enrichDetails.withSource(HandlerClass.sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(queryParamsParsed.error!))
                        )
                    )
                }

                input = { ...input, ...queryParamsParsed.data }
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
                        schema = schema.extend(HandlerClass.inputSchema.pick({ [field]: true }).shape)
                    }
                    if (typeof rule === 'object' && rule && 'customSchema' in rule) {
                        schema = schema.extend({ [field]: rule.customSchema })
                    }
                }
                const bodyParsed = schema.safeParse(body)
                if (!bodyParsed.success) {
                    throw new NextAdapterError('INVALID_BODY_PAYLOAD', enrichDetails.withSource(HandlerClass.sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(bodyParsed.error!))
                        )
                    )
                }

                input = {...input, ...bodyParsed.data}
            }

            return input as z.infer<InputSchema>
        }

        return {
            input: inputFromNextRequest,
            output: async (x) => {
                if (!x.failed) {
                    return NextResponse.json(x.output)
                }
                return NextResponse.json(x.error, { status: 500 })
            }
        }
    }
}


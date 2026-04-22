import { NextRequest, NextResponse } from 'next/server'
import z, { ZodObject, ZodString } from 'zod'
import { Adapter, SpringReverbHandler, handleWithAdapter } from './handler'
import { Limiter, enrichDetails } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'
import { APIInputSchemas } from './api-adapter-types'

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


export const nextAdapter = <
    InputSchema extends ZodObject, 
    OutputSchema extends ZodObject, 
    QuerySchema extends ZodObject<Record<string, ZodString>> | undefined, 
    BodySchema extends ZodObject | undefined
>(
    handler: SpringReverbHandler<InputSchema, OutputSchema>,
    schemasGenerator: APIInputSchemas<InputSchema, QuerySchema, BodySchema>,
    inputMapping: (x: z.infer<QuerySchema> & z.infer<BodySchema>) => z.infer<InputSchema>
) => {
    const schemas = schemasGenerator(handler.inputSchema)

    const adapter: Adapter<[request: NextRequest], NextResponse, InputSchema, OutputSchema> = {
        input: async (request: NextRequest): Promise<z.infer<InputSchema>> => {
            let input: Record<string, any> = {}

            if ('querySchema' in schemas) {
                const queryParamsAsObject = Object.fromEntries(
                    request.nextUrl.searchParams.entries()
                );

                const queryParamsParsed = schemas.querySchema.safeParse(queryParamsAsObject);

                if (!queryParamsParsed.success) {
                    throw new NextAdapterError('INVALID_QUERY_PARAMS', enrichDetails.withSource(handler.sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(queryParamsParsed.error!))
                        )
                    )
                }

                input = { ...input, ...queryParamsParsed.data }
            }

            if ('bodySchema' in schemas) {
                const body = await request.json();

                const bodyParsed = schemas.bodySchema.safeParse(body)
                if (!bodyParsed.success) {
                    throw new NextAdapterError('INVALID_BODY_PAYLOAD', enrichDetails.withSource(handler.sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(bodyParsed.error!))
                        )
                    )
                }

                input = {...input, ...bodyParsed.data}
            }

            return inputMapping(input as z.infer<QuerySchema> & z.infer<BodySchema>)
        },
        output: async (x) => {
            if (x.success) {
                return NextResponse.json(x.output)
            }
            return NextResponse.json(x.error, { status: 500 })
        }
    }

    const result = handleWithAdapter(handler, adapter)

    return Object.assign(result, { ___api_metadata:  {  ...schemas, response: handler.outputSchema }  })
}

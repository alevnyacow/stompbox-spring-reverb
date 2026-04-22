import { Request, Response } from 'express'
import { Adapter, SpringReverbHandler, handleWithAdapter } from './handler'
import z, { ZodObject, ZodString, ZodType } from 'zod'
import { APIInputSchemas } from './api-adapter-types'
import { enrichDetails, Limiter } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'

const expressAdapterDefaultErrors = {
    INVALID_QUERY_PARAMS: 'SPRING-REVERB___EXPRESS-ADAPTER-INVALID-QUERY-PARAMS',
    INVALID_BODY_PAYLOAD: 'SPRING-REVERB___EXPRESS-ADAPTER-INVALID-BODY-PAYLOAD',
}

const expressAdapterErrors = {
    NOT_FOUND: 'SPRING-REVERB___EXPRESS-ADAPTER-NOT-FOUND'
}

export class ExpressAdapterError extends Limiter({
    ...expressAdapterDefaultErrors,
    ...expressAdapterErrors
}) { }

type ExpressAdapter<InputSchema extends ZodObject, OutputSchema extends ZodObject> = Adapter<[req: Request, res: Response], void, InputSchema, OutputSchema>

export const expressAdapter = <
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

    const adapter: ExpressAdapter<InputSchema, OutputSchema> = {
        output: (x, _req, res) => {
            if (x.success) {
                res.send(x.output)
                return
            }
            res.status(500).send(x.error)
        },
        input: (req, _res) => {
            let input: Record<string, any> = {}


            if ('querySchema' in schemas) {
                const queryParamsAsObject = req.query
                const queryParamsParsed = schemas.querySchema.safeParse(queryParamsAsObject);

                if (!queryParamsParsed.success) {
                    throw new ExpressAdapterError('INVALID_QUERY_PARAMS', enrichDetails.withSource(handler.sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(queryParamsParsed.error!))
                        )
                    )
                }

                input = { ...input, ...queryParamsParsed.data }
            }

            if ('bodySchema' in schemas) {
                const bodyParsed = schemas.bodySchema.safeParse(req.body)
                if (!bodyParsed.success) {
                    throw new ExpressAdapterError('INVALID_BODY_PAYLOAD', enrichDetails.withSource(handler.sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(bodyParsed.error!))
                        )
                    )
                }

                input = {...input, ...bodyParsed.data}

            }

            return inputMapping(input as z.infer<QuerySchema> & z.infer<BodySchema>)
        }
    }

    const result = handleWithAdapter(handler, adapter)

    return Object.assign(result, { ___api_metadata:  {  ...schemas, response: handler.outputSchema }  })
}


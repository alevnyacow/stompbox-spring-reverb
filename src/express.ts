import { Request, Response } from 'express'
import { Adapter, Handler, withAdapter } from './handler'
import z, { ZodObject, ZodType } from 'zod'
import { ParametersMapping } from './api-adapter-types'
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

export const withExpressAdapter = <InputSchema extends ZodObject, OutputSchema extends ZodObject>(
    handler: Handler<InputSchema, OutputSchema>,
    parametersMapping: ParametersMapping<InputSchema>
) => {
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

            const queryParameters = Object.entries(parametersMapping)
                .filter(([, x]) => x === 'query' || x.source === 'query') as [string, 'query' | { customSchema: ZodType }][] 

            if (queryParameters.length) {
                const queryParamsAsObject = req.query

                let schema: ZodObject = z.object({})

                for (const entry of queryParameters) {
                    const [field, rule] = entry
                    if (rule === 'query') {
                        // @ts-expect-error
                        schema = schema.extend(handler.inputSchema.pick({ [field]: true }).shape)
                    }
                    if (typeof rule === 'object' && rule && 'customSchema' in rule) {
                        schema = schema.extend({ [field]: rule.customSchema })
                    }
                }

                const queryParamsParsed = schema.safeParse(queryParamsAsObject);

                if (!queryParamsParsed.success) {
                    throw new ExpressAdapterError('INVALID_QUERY_PARAMS', enrichDetails.withSource(handler.sourceForErrorDetails)(
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
                const body = req.body;
                for (const bodyEntry of bodyEntries) {
                    const [field, rule] = bodyEntry
                    if (rule === 'body') {
                        // @ts-expect-error
                        schema = schema.extend(handler.inputSchema.pick({ [field]: true }).shape)
                    }
                    if (typeof rule === 'object' && rule && 'customSchema' in rule) {
                        schema = schema.extend({ [field]: rule.customSchema })
                    }
                }
                const bodyParsed = schema.safeParse(body)
                if (!bodyParsed.success) {
                    throw new ExpressAdapterError('INVALID_BODY_PAYLOAD', enrichDetails.withSource(handler.sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(bodyParsed.error!))
                        )
                    )
                }

                input = {...input, ...bodyParsed.data}
            }

            return input as z.infer<InputSchema>
        }
    }
    return withAdapter(handler, adapter)
}


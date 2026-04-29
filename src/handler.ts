import z, { ZodObject, ZodString, ZodType } from "zod";
import { Limiter, enrichDetails } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'
import { APIDataAdapter, APIInputSchemas, ComplexZodSchemaPart, PrimitiveZodSchemaPart } from "./api-adapter-types";
import { _Middleware, compose, SpringContext } from "./handler-utils";

enum SpringReverbErrorCodes {
    INVALID_INPUT = 'SPRING-REVERB___INVALID-INPUT',
    INVALID_OUTPUT = 'SPRING-REVERB___INVALID-OUTPUT',
    UNHANDLED_EXCEPTION = 'SPRING-REVERB___UNHANDLED_EXCEPTION'
}

export type SpringReverbHandlerResponse<OutputSchema extends ZodType> = 
    | { success: true, output: z.infer<OutputSchema> } 
    | { success: false, error: Error }

export type SpringReverbHandler<InputSchema extends ZodType, OutputSchema extends ZodType> = ((
    input: z.infer<InputSchema>,
) => Promise<SpringReverbHandlerResponse<OutputSchema>>) & { 
    unsafe: (input: z.infer<InputSchema>) => Promise<z.infer<OutputSchema>>,
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
    sourceForErrorDetails?: string,
}

export class SpringReverbError extends Limiter(SpringReverbErrorCodes) {}

export type PreHandlerMiddleware<Input = void, Ctx = void> = (
    ctx: { parsedInput: Input, error?: Error, context: Ctx },
    next: () => Promise<void>
) => Promise<void>

export type AfterHandlerMiddleware<Input = void, Output = void, Ctx = void> = (
    ctx: { parsedInput: Input, context: Ctx, output: Output },
    next: () => Promise<void>
) => Promise<void>

const springReverbBase = <
    Input extends ZodType,
    Output extends ZodType,
    Context = void
>(
    inputSchema: Input,
    outputSchema: Output,
    handler:
        | ((x: z.infer<Input>) => z.infer<Output> | Promise<z.infer<Output>>)
        | {
              getContext: () => Promise<Context> | Context
              handler: (
                  x: z.infer<Input>,
                  ctx: Context
              ) => z.infer<Output> | Promise<z.infer<Output>>
          },
    sourceForErrorDetails?: string,
    preHandler: PreHandlerMiddleware<z.infer<Input>, Context>[] = [],
    afterHandler: AfterHandlerMiddleware<z.infer<Input>, z.infer<Output>, Context>[] = [],
    onError: ((x: Error) => (void | Promise<void>))[] = []
) => {
    const coreMiddleware: _Middleware<
        z.infer<Input>,
        z.infer<Output>,
        Context
    > = async (ctx, next) => {
        try {
            const parsedInput = inputSchema.safeParse(ctx.rawInput)
            if (!parsedInput.success) {
                throw new SpringReverbError(
                    'INVALID_INPUT',
                    enrichDetails.withSource(sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(parsedInput.error)
                        )
                    )
                )
            }

            ctx.parsedInput = parsedInput.data

            if (typeof handler === 'object' && 'getContext' in handler) {
                ctx.context = await handler.getContext()
            }

            await next()
        } catch (e: any) {
            ctx.error =
                e instanceof Error
                    ? e
                    : new SpringReverbError(
                          'UNHANDLED_EXCEPTION',
                          enrichDetails.fromUnknownData(e)()
                      )

            for (const errorHandler of onError) {
                await errorHandler(ctx.error)
            }           
            
        }
    }

    const handlerMiddleware: _Middleware<
        z.infer<Input>,
        z.infer<Output>,
        Context
    > = async (ctx, next) => {
        if (ctx.error) return

        try {
            if (typeof handler === 'function') {
                const result = await handler(ctx.parsedInput!)
                const parsedOutput = outputSchema.safeParse(result)
                if (!parsedOutput.success) {
                    throw new SpringReverbError(
                        'INVALID_OUTPUT',
                        enrichDetails.withSource(sourceForErrorDetails)(
                            enrichDetails.withTimespamp(
                                zodErrorDetails(parsedOutput.error)
                            )
                        )
                    )
                }
                ctx.output = parsedOutput.data
            } else {
                const result = await handler.handler(
                    ctx.parsedInput!,
                    ctx.context as Context
                )
                const parsedOutput = outputSchema.safeParse(result)
                if (!parsedOutput.success) {
                    throw new SpringReverbError(
                        'INVALID_OUTPUT',
                        enrichDetails.withSource(sourceForErrorDetails)(
                            enrichDetails.withTimespamp(
                                zodErrorDetails(parsedOutput.error)
                            )
                        )
                    )
                }
                ctx.output = parsedOutput.data
            }
        } catch (e: any) {
            ctx.error = e
        }

        await next()
    }

    const pipeline = compose([
        coreMiddleware,
        ...preHandler,
        handlerMiddleware,
        ...afterHandler
    ], async (e) => { console.error('eee', e) })

    const logic = async (
        input: z.infer<Input>
    ): Promise<SpringReverbHandlerResponse<Output>> => {
        const ctx: SpringContext<
            z.infer<Input>,
            z.infer<Output>,
            Context
        > = {
            rawInput: input
        }

        await pipeline(ctx)

        if (ctx.error) {
            return { success: false, error: ctx.error }
        }

        return { success: true, output: ctx.output! }
    }

    const unsafe = async (input: z.infer<Input>) => {
        const result = await logic(input)
        if (!result.success) throw result.error
        return result.output
    }

    const REST = <RESTInput extends unknown[], RESTOutput>(adapter: APIDataAdapter<RESTInput, RESTOutput>) => {
        const defaultSchema = () => {
                const schema = (inputSchema as any as ZodObject)

                const stringFields = Object.entries(schema.shape).filter(x => x[1].type === 'string').map(x => x[0])
                const numericFields = Object.entries(schema.shape).filter(x => x[1].type === 'number').map(x => x[0])
                const booleanFields = Object.entries(schema.shape).filter(x => x[1].type === 'boolean').map(x => x[0])
                const dateFields = Object.entries(schema.shape).filter(x => x[1].type === 'date').map(x => x[0])

                let querySchema = z.object({})

                for (const str of stringFields) {
                    querySchema = querySchema.extend({ [str]: z.string() })
                }
                for (const num of numericFields) {
                    querySchema = querySchema.extend({ [num]: z.coerce.number() })
                }
                for (const bool of booleanFields) {
                    querySchema = querySchema.extend({ [bool]: z.coerce.boolean() })
                }
                for (const date of dateFields) {
                    querySchema = querySchema.extend({ [date]: z.coerce.date() })
                }

                type Query = PrimitiveZodSchemaPart<Input extends ZodObject ? Input : ZodObject>
                type Body = ComplexZodSchemaPart<Input extends ZodObject ? Input : ZodObject>

                const objectFields = Object.entries(schema.shape).filter(x => x[1].type === 'object').map(x => x[0])
                const arrayFields = Object.entries(schema.shape).filter(x => x[1].type === 'array').map(x => x[0])

                const bodySchema = schema.pick(
                    // @ts-ignore
                    Object.fromEntries([...objectFields, ...arrayFields].map(x => ([x, true as const])))
                )

                type ResultSchemas = (Query extends never ? {} : { querySchema: Query }) & (Body extends never ? {} : { bodySchema: Body }) & { response: Output }

                const handler = async (...i: RESTInput) => {
                    const { body, query } = await adapter.dataObtainer(...i)
                    const input = { ...bodySchema.parse(body), ...querySchema.parse(query) }
                    const result = await logic(input as z.infer<Input>)
                    return await adapter.responseMapper(result, ...i)
                }

                return Object.assign(handler, { ___api_metadata: {
                    querySchema,
                    bodySchema,
                    response: outputSchema
                } as unknown as ResultSchemas })
        }

        const customSchema = <
            QuerySchema extends ZodObject<Record<string, ZodString>> | undefined, 
            BodySchema extends ZodObject | undefined
        >(
            schemasGenerator: Input extends ZodObject ? APIInputSchemas<Input, QuerySchema, BodySchema> : never,
            inputMapping?: (x: z.infer<QuerySchema> & z.infer<BodySchema>) => z.infer<Input>
        ) => {
            // @ts-ignore
            const schemas = schemasGenerator(inputSchema)

            const handler = async (...i: RESTInput) => {
                const { body, query } = await adapter.dataObtainer(...i)
                let inputData: Record<string, any> = {}

                if ('querySchema' in schemas) {
                    const queryParamsParsed = schemas.querySchema.parse(query);

                    inputData = { ...inputData, ...queryParamsParsed }
                }

                if ('bodySchema' in schemas) {
                    const bodyParsed = schemas.bodySchema.parse(body)

                    inputData = {...inputData, ...bodyParsed}
                }

                const resultInput = inputMapping 
                    ? inputMapping(inputData as z.infer<QuerySchema> & z.infer<BodySchema>) 
                    : inputData as z.infer<Input>

                const result = await logic(resultInput)
                return await adapter.responseMapper(result, ...i)
            }
            return Object.assign(handler, { ___api_metadata: { ...schemas, response: outputSchema } })
        }

        const handler = defaultSchema()
        return Object.assign(handler, { customSchema })
    }

    const result = Object.assign(logic, { 
        inputSchema, 
        outputSchema, 
        sourceForErrorDetails, 
        unsafe,
        REST
    })

    return result
}

export function createHandler<Input extends ZodType, Output extends ZodType, Context>(
    base: {
        input: Input,
        output: Output,
        getContext: () => (Context | Promise<Context>),
        handler: (input: z.infer<Input>, ctx: Context) => Promise<z.infer<Output>> | z.infer<Output>,
        middlewares?: {
            beforeHandler?: Array<PreHandlerMiddleware<z.infer<Input>, void>>,
            afterHandler?: AfterHandlerMiddleware<z.infer<Input>, z.infer<Output>, Context>[],
            onError?: ((e: Error) => void | Promise<void>)[] 
        },
    },
    additionalMetadata?: {
        sourceForErrorDetails?: string
    }
): ReturnType<typeof springReverbBase<Input, Output, Context>>

export function createHandler<Input extends ZodType, Output extends ZodType>(
    base: {
        input: Input,
        output: Output,
        handler: (input: z.infer<Input>) => Promise<z.infer<Output>> | z.infer<Output>,
        middlewares?: {
            beforeHandler?: Array<PreHandlerMiddleware<z.infer<Input>, void>>,
            afterHandler?: AfterHandlerMiddleware<z.infer<Input>, z.infer<Output>>[],
            onError?: ((e: Error) => void | Promise<void>)[] 
        }
    },
    additionalMetadata?: {
        sourceForErrorDetails?: string
    }
): ReturnType<typeof springReverbBase<Input, Output>>

export function createHandler(metadata: any, additionalMetadata: any) {
    return springReverbBase(
        metadata.input,
        metadata.output,
        metadata.getContext ? { getContext: metadata.getContext, handler: metadata.handler } : metadata.handler,
        additionalMetadata?.sourceForErrorDetails,
        metadata?.middlewares?.beforeHandler,
        metadata?.middlewares?.afterHandler,
        metadata?.middlewares?.onError
    )
}
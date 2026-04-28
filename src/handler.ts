import z, { ZodObject, ZodString, ZodType } from "zod";
import { Limiter, enrichDetails } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'
import { APIDataAdapter, APIInputSchemas } from "./api-adapter-types";

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

const springReverbBase = <Input extends ZodType, Output extends ZodType, Context = void>(
    inputSchema: Input, 
    outputSchema: Output,
    handler:
    // Without context
    | ((x: z.infer<Input>) => z.infer<Output> | Promise<z.infer<Output>>)
    // With context
    | {
        getContext: () => Promise<Context> | Context,
        handler: (x: z.infer<Input>, ctx: Context) => z.infer<Output> | Promise<z.infer<Output>>
    },
    sourceForErrorDetails?: string
) => {
    const logic = async (input: z.infer<Input>): Promise<SpringReverbHandlerResponse<Output>> => {
        try {
            const parsedInput = inputSchema.safeParse(input)
            if (!parsedInput.success) {
                throw new SpringReverbError('INVALID_INPUT', enrichDetails.withSource(sourceForErrorDetails)(
                    enrichDetails.withTimespamp(
                        zodErrorDetails(parsedInput.error)
                    )
                ))
            }
            const output = 'getContext' in handler 
                ? await handler.handler(parsedInput.data, await handler.getContext()) 
                : await handler(parsedInput.data)
            const parsedOutput = outputSchema.safeParse(output)
            if (!parsedOutput.success) {
                throw new SpringReverbError('INVALID_OUTPUT', enrichDetails.withSource(sourceForErrorDetails)(
                    enrichDetails.withTimespamp(
                        zodErrorDetails(parsedOutput.error))
                    )
                )
            }
            return { success: true, output: parsedOutput.data }
        } catch (e: unknown) {
            if (e instanceof Error) {
                return { success: false, error: e }
            }
            const error = new SpringReverbError('UNHANDLED_EXCEPTION', enrichDetails.fromUnknownData(e)())
            return { 
                success: false, 
                error,
            }
        }
    }

    const unsafe = async (input: z.infer<Input>): Promise<z.infer<Output>> => {
        const result = await logic(input)
        if (result.success) {
            return result.output
        }
        throw result.error
    }

    const REST = <RESTInput extends unknown[], RESTOutput>(adapter: APIDataAdapter<RESTInput, RESTOutput>) => {
        return {
            allInQuery: () => {
                const handler = async (...input: RESTInput) => {
                    const { query } = await adapter.dataObtainer(...input)
                    const inputData = inputSchema.parse(query)
                    const result = await logic(inputData)
                    return adapter.responseMapper(result, ...input)
                }
                return Object.assign(handler, { ___api_metadata: { querySchema: inputSchema, response: outputSchema } })
            },

            allInBody: () => {
                const handler = async (...input: RESTInput) => {
                    const { body } = await adapter.dataObtainer(...input)
                    const inputData = inputSchema.parse(body)
                    const result = await logic(inputData)
                    return adapter.responseMapper(result, ...input)
                }
                return Object.assign(handler, { ___api_metadata: { bodySchema: inputSchema, response: outputSchema } })
            },

            customSchema: <
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
        }
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
        handler: (input: z.infer<Input>, ctx: Context) => Promise<z.infer<Output>> | z.infer<Output>
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
        additionalMetadata?.sourceForErrorDetails
    )
}
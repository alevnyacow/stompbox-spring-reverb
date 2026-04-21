import z, { ZodType } from "zod";
import { Limiter, enrichDetails } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'

enum SpringReverbErrorCodes {
    INVALID_INPUT = 'SPRING-REVERB___INVALID-INPUT',
    INVALID_OUTPUT = 'SPRING-REVERB___INVALID-OUTPUT',
    UNHANDLED_EXCEPTION = 'SPRING-REVERB___UNHANDLED_EXCEPTION'
}

type SpringReverbHandlerResponse<OutputSchema extends ZodType> = 
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

export type Adapter<
  Args extends unknown[],
  AdapterOutput,
  InputSchema extends ZodType,
  OutputSchema extends ZodType
> = {
  input: (...args: Args) => z.infer<InputSchema> | Promise<z.infer<InputSchema>>
  output: (
    result: SpringReverbHandlerResponse<OutputSchema>,
    ...args: Args
  ) => AdapterOutput | Promise<AdapterOutput>
}

export const handleWithAdapter = <
  AdapterArgs extends unknown[],
  AdapterOutput,
  InputSchema extends ZodType,
  OutputSchema extends ZodType
>(
  handler: SpringReverbHandler<InputSchema, OutputSchema>,
  adapter: Adapter<AdapterArgs, AdapterOutput, InputSchema, OutputSchema>
) => {
  return async (...adapterArgs: AdapterArgs): Promise<AdapterOutput> => {
    const input = await adapter.input(...adapterArgs)
    const result = await handler(input)
    const adapterOutput = await adapter.output(result, ...adapterArgs)

    return adapterOutput
  }
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
): SpringReverbHandler<Input, Output> => {
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

    const result = Object.assign(logic, { 
        inputSchema, 
        outputSchema, 
        sourceForErrorDetails, 
        unsafe 
    })

    return result
}

export const springReverb = <Input extends ZodType, Output extends ZodType> (
    inputSchema: Input, 
    outputSchema: Output,
    handler: (input: z.infer<Input>) => z.infer<Output> | Promise<z.infer<Output>>,
    sourceForErrorDetails?: string
) => {
    return springReverbBase(
        inputSchema,
        outputSchema,
        handler,
        sourceForErrorDetails
    )
}

export const springReverbWithCtx = <Context>(getContext: () => Context | Promise<Context>) => {
    return <Input extends ZodType, Output extends ZodType>(
        inputSchema: Input,
        outputSchema: Output,
        handler: (input: z.infer<Input>, ctx: Context) => z.infer<Output> | Promise<z.infer<Output>>,
        sourceForErrorDetails?: string
    ) => {
        return springReverbBase(
            inputSchema,
            outputSchema,
            {
                getContext,
                handler
            },
            sourceForErrorDetails
        )
    }
}
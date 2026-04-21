import z, { ZodType } from "zod";
import { Limiter, enrichDetails } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'

enum SpringReverbErrorCodes {
    INVALID_INPUT = 'SPRING-REVERB___INVALID-INPUT',
    INVALID_OUTPUT = 'SPRING-REVERB___INVALID-OUTPUT',
    UNHANDLED_EXCEPTION = 'SPRING-REVERB___UNHANDLED_EXCEPTION'
}

type HandlerResponse<OutputSchema extends ZodType> = 
    { unwrap: () => z.infer<OutputSchema> } & (
        | { failed: false, output: z.infer<OutputSchema> } 
        | { failed: true, error: Error }
    )

export type Handler<InputSchema extends ZodType, OutputSchema extends ZodType> = ((
    input: z.infer<InputSchema>
) => Promise<HandlerResponse<OutputSchema>>) & { 
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
    result: HandlerResponse<OutputSchema>,
    ...args: Args
  ) => AdapterOutput | Promise<AdapterOutput>
}

export const withAdapter = <
  AdapterArgs extends unknown[],
  AdapterOutput,
  InputSchema extends ZodType,
  OutputSchema extends ZodType
>(
  handler: Handler<InputSchema, OutputSchema>,
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

export const springReverb = <Input extends ZodType, Output extends ZodType>(
    inputSchema: Input, 
    outputSchema: Output,
    handler: (x: z.infer<Input>) => z.infer<Output> | Promise<z.infer<Output>>, 
    sourceForErrorDetails?: string
): Handler<Input, Output> => {
    const logic = async (input: z.infer<Input>): Promise<HandlerResponse<Output>> => {
        try {
            const parsedInput = inputSchema.safeParse(input)
            if (!parsedInput.success) {
                throw new SpringReverbError('INVALID_INPUT', enrichDetails.withSource(sourceForErrorDetails)(
                    enrichDetails.withTimespamp(
                        zodErrorDetails(parsedInput.error)
                    )
                ))
            }
            const output = await handler(parsedInput.data)
            const parsedOutput = outputSchema.safeParse(output)
            if (!parsedOutput.success) {
                throw new SpringReverbError('INVALID_OUTPUT', enrichDetails.withSource(sourceForErrorDetails)(
                    enrichDetails.withTimespamp(
                        zodErrorDetails(parsedOutput.error))
                    )
                )
            }
            return { failed: false, output: parsedOutput.data, unwrap: () => parsedOutput.data }
        } catch (e: unknown) {
            if (e instanceof Error) {
                return { failed: true, error: e, unwrap: () => { throw e } }
            }
            const error = new SpringReverbError('UNHANDLED_EXCEPTION', enrichDetails.fromUnknownData(e)())
            return { 
                failed: true, 
                error,
                unwrap: () => { throw error }
            }
        }
    }

    const result = Object.assign(logic, { inputSchema, outputSchema, sourceForErrorDetails })

    return result
}

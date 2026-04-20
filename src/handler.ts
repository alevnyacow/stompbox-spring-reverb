import z, { ZodType } from "zod";
import { Limiter, LimiterError, enrichDetails, isLimiterError } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'

enum HandlerErrorCodes {
    INVALID_INPUT = 'SPRING-REVERB___INVALID-INPUT',
    INVALID_OUTPUT = 'SPRING-REVERB___INVALID-OUTPUT',
    UNHANDLED_EXCEPTION = 'SPRING-REVERB___UNHANDLED_EXCEPTION'
}

export type HandlerResponse<OutputSchema extends ZodType> = 
    | { failed: false, output: z.infer<OutputSchema> } 
    | { failed: true, error: LimiterError }

export type Adapter<AdapterInput, AdapterOutput, HandlerInputSchema extends ZodType, HandlerOutputSchema extends ZodType> = {
    input: (x: AdapterInput) => Promise<z.infer<HandlerInputSchema>>,
    output: (x: HandlerResponse<HandlerOutputSchema>, adapterInput: AdapterInput) => Promise<AdapterOutput>
}

export class HandlerError extends Limiter(HandlerErrorCodes) {}

export const handler = <Input extends ZodType, Output extends ZodType>(
    inputSchema: Input, 
    outputSchema: Output,
    handler: (x: z.infer<Input>) => Promise<z.infer<Output>>, 
    sourceForErrorDetails?: string
) => {
    class CreatedHandler extends Handler(inputSchema, outputSchema, sourceForErrorDetails) {
        executeRaw = handler
    }

    return new CreatedHandler()
}

export const Handler = <Input extends ZodType, Output extends ZodType>(inputSchema: Input, outputSchema: Output, sourceForErrorDetails?: string) => {
    abstract class HandlerClass {
        public static inputSchema = inputSchema
        public static outputSchema = outputSchema
        public static sourceForErrorDetails = sourceForErrorDetails

        public inputSchema = inputSchema
        public outputSchema = outputSchema
        public sourceForErrorDetails = sourceForErrorDetails

        abstract executeRaw(input: z.infer<Input>): Promise<z.infer<Output>>

        execute = async (input: z.infer<Input>): Promise<HandlerResponse<Output>> => {
            try {
                const parsedInput = HandlerClass.inputSchema.safeParse(input)
                if (!parsedInput.success) {
                    throw new HandlerError('INVALID_INPUT', enrichDetails.withSource(sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(parsedInput.error)
                        )
                    ))
                }
                const output = await this.executeRaw(parsedInput.data)
                const parsedOutput = HandlerClass.outputSchema.safeParse(output)
                if (!parsedOutput.success) {
                    throw new HandlerError('INVALID_OUTPUT', enrichDetails.withSource(sourceForErrorDetails)(
                        enrichDetails.withTimespamp(
                            zodErrorDetails(parsedOutput.error))
                        )
                    )
                }
                return { failed: false, output: parsedOutput.data }  //[parsedOutput.data, null]
            } catch (e: unknown) {
                if (isLimiterError(e)) {
                    return { failed: true, error: e }
                }
                return { failed: true, error: new HandlerError('UNHANDLED_EXCEPTION', enrichDetails.fromUnknownData(e)()) }
            }
        }

        withAdapter = <AdapterInput, AdapterOutput>(adapter: Adapter<AdapterInput, AdapterOutput, Input, Output>) => {
            return async (adapterInput: AdapterInput): Promise<AdapterOutput> => { 
                const input = await adapter.input(adapterInput)
                const result = await this.execute(input)
                const adapterOutput = await adapter.output(result, adapterInput)
                
                return adapterOutput
            }
        } 
    }
    
    return HandlerClass
}

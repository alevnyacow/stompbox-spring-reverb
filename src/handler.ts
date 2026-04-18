import z, { ZodType } from "zod";
import { Limiter } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'

enum HandlerErrorCodes {
    INVALID_INPUT = 'HANDLER___INVALID_INPUT',
    INVALID_OUTPUT = 'HANDLER___INVALID_OUTPUT'
}

export type Adapter<AdapterInput, AdapterOutput, HandlerInputSchema extends ZodType, HandlerOutputSchema extends ZodType> = {
    input: (x: AdapterInput) => Promise<z.infer<HandlerInputSchema>>,
    output: (x: z.infer<HandlerOutputSchema>) => Promise<AdapterOutput>
}

export class HandlerError extends Limiter(HandlerErrorCodes) {}

export const Handler = <Input extends ZodType, Output extends ZodType>(inputSchema: Input, outputSchema: Output) => {
    abstract class HandlerClass {
        public static inputSchema = inputSchema
        public static outputSchema = outputSchema

        abstract handleLoose(input: z.infer<Input>): Promise<z.infer<Output>>

        handle = async (input: z.infer<Input>): Promise<z.infer<Output>> => {
            const parsedInput = HandlerClass.inputSchema.safeParse(input)
            if (!parsedInput.success) {
                throw new HandlerError('INVALID_INPUT', zodErrorDetails(parsedInput.error))
            }
            const output = await this.handleLoose(parsedInput.data)
            const parsedOutput = HandlerClass.outputSchema.safeParse(output)
            if (!parsedOutput.success) {
                throw new HandlerError('INVALID_OUTPUT', zodErrorDetails(parsedOutput.error))
            }
            return parsedOutput.data
        }

        handleWithAdapter = <TransformInput, TransformOutput>(adapter: Adapter<TransformInput, TransformOutput, Input, Output>) => {
            return async (transformedInput: TransformInput): Promise<TransformOutput> => { 
                const input = await adapter.input(transformedInput)
                const result = await this.handle(input)
                const mappedResult = await adapter.output(result)
                return mappedResult
            }

        } 
    }
    

    return HandlerClass
}

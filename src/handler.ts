import z, { ZodType } from "zod";
import { Limiter, enrichDetails } from '@stompbox/limiter'
import { zodErrorDetails } from '@stompbox/limiter/zod'

enum UseCaseErrorCodes {
    INVALID_INPUT = 'SPRING-REVERB___INVALID-USE-CASE-INPUT',
    INVALID_OUTPUT = 'SPRING-REVERB___INVALID-USE-CASE-OUTPUT'
}

export type Adapter<AdapterInput, AdapterOutput, HandlerInputSchema extends ZodType, HandlerOutputSchema extends ZodType> = {
    input: (x: AdapterInput) => Promise<z.infer<HandlerInputSchema>>,
    output: (x: z.infer<HandlerOutputSchema>, adapterInput: AdapterInput) => Promise<AdapterOutput>
}

export class UseCaseError extends Limiter(UseCaseErrorCodes) {}

export const createUseCase = <Input extends ZodType, Output extends ZodType>(
    inputSchema: Input, 
    outputSchema: Output,
    handler: (x: z.infer<Input>) => Promise<z.infer<Output>>, 
    sourceForErrorDetails?: string
) => {
    class UseCaseHandler extends UseCase(inputSchema, outputSchema, sourceForErrorDetails) {
        executeRaw = handler
    }

    return new UseCaseHandler()
}

export const UseCase = <Input extends ZodType, Output extends ZodType>(inputSchema: Input, outputSchema: Output, sourceForErrorDetails?: string) => {
    abstract class HandlerClass {
        public static inputSchema = inputSchema
        public static outputSchema = outputSchema
        public static sourceForErrorDetails = sourceForErrorDetails

        abstract executeRaw(input: z.infer<Input>): Promise<z.infer<Output>>

        execute = async (input: z.infer<Input>): Promise<z.infer<Output>> => {
            const parsedInput = HandlerClass.inputSchema.safeParse(input)
            if (!parsedInput.success) {
                throw new UseCaseError('INVALID_INPUT', enrichDetails.withSource(sourceForErrorDetails)(
                    enrichDetails.withTimespamp(
                        zodErrorDetails(parsedInput.error)
                    )
                ))
            }
            const output = await this.executeRaw(parsedInput.data)
            const parsedOutput = HandlerClass.outputSchema.safeParse(output)
            if (!parsedOutput.success) {
                throw new UseCaseError('INVALID_OUTPUT', enrichDetails.withSource(sourceForErrorDetails)(
                    enrichDetails.withTimespamp(
                        zodErrorDetails(parsedOutput.error))
                    )
                )
            }
            return parsedOutput.data
        }

        withAdapter = <TransformInput, TransformOutput>(adapter: Adapter<TransformInput, TransformOutput, Input, Output>) => {
            return async (transformedInput: TransformInput): Promise<TransformOutput> => { 
                const input = await adapter.input(transformedInput)
                const result = await this.execute(input)
                const mappedResult = await adapter.output(result, transformedInput)
                return mappedResult
            }
        } 
    }
    
    return HandlerClass
}
import z, { ZodType } from "zod";

export const Handler = <Input extends ZodType, Output extends ZodType>(inputSchema: Input, outputSchema: Output) => {
    abstract class HandlerClass {
        public static inputSchema = inputSchema
        public static outputSchema = outputSchema

        abstract handleLoose(input: z.infer<Input>): Promise<z.infer<Output>>

        handle = async (data: z.infer<Input>): Promise<z.infer<Output>> => {
            const input = HandlerClass.inputSchema.parse(data)
            const output = await this.handleLoose(input)
            return HandlerClass.outputSchema.parse(output)
        }

        handleWithAdapter = <TransformInput, TransformOutput>(adapter: {
            input: (x: TransformInput) => z.infer<Input>,
            output: (x: z.infer<Output>) => TransformOutput
        }) => async (transformedInput: TransformInput): Promise<TransformOutput> => {
            const input = adapter.input(transformedInput)
            const result = await this.handle(input)
            return adapter.output(result)
        }

        handleLooseWithAdapter = <TransformInput, TransformOutput>(adapter: {
            input: (x: TransformInput) => z.infer<Input>,
            output: (x: z.infer<Output>) => TransformOutput
        }) => async (transformedInput: TransformInput): Promise<TransformOutput> => {
            const input = adapter.input(transformedInput)
            const result = await this.handleLoose(input)
            return adapter.output(result)
        }
    }

    return HandlerClass
}

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

        handleWithTransform = <TransformInput, TransformOutput>(transformer: {
            input: (x: TransformInput) => z.infer<Input>,
            output: (x: z.infer<Output>) => TransformOutput
        }) => async (transformedInput: TransformInput): Promise<TransformOutput> => {
            const input = transformer.input(transformedInput)
            const result = await this.handle(input)
            return transformer.output(result)
        }

        handleLooseWithTransform = <TransformInput, TransformOutput>(transformer: {
            input: (x: TransformInput) => z.infer<Input>,
            output: (x: z.infer<Output>) => TransformOutput
        }) => async (transformedInput: TransformInput): Promise<TransformOutput> => {
            const input = transformer.input(transformedInput)
            const result = await this.handleLoose(input)
            return transformer.output(result)
        }
    }

    return HandlerClass
}

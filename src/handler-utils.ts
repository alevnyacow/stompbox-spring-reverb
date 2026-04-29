import { AfterHandlerMiddleware, PreHandlerMiddleware } from "./handler"

export type SpringContext<Input, Output, Ctx> = {
    rawInput: Input
    parsedInput?: Input
    context?: Ctx
    output?: Output
    error?: Error
}

export type _Middleware<Input, Output, Ctx> = (
    ctx: SpringContext<Input, Output, Ctx>,
    next: () => Promise<void>
) => Promise<void>

export const compose = <Input, Output, Ctx>(
    middlewares: (
        _Middleware<Input, Output, Ctx> 
        | PreHandlerMiddleware<Input, Ctx> 
        | AfterHandlerMiddleware<Input, Output, Ctx>
    )[],
    onError: (e: Error) => Promise<void> 
) => {
    return (ctx: SpringContext<Input, Output, Ctx>) => {
        let index = -1

        const dispatch = async (i: number): Promise<void> => {
            if (i <= index) throw new Error('next() called multiple times')
            index = i

            const fn = middlewares[i]
            if (!fn) return

            if (i > 0 && ctx.rawInput) {
                // @ts-ignore
                delete ctx.rawInput
            }

            if (ctx.error) {
                await onError(ctx.error)
                return
            }

            // @ts-ignore
            await fn(ctx, () => dispatch(i + 1))
        }

        return dispatch(0)
    }
}


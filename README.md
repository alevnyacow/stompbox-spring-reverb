# Spring Reverb

Framework-agnostic plug-and-play use cases with built-in adapters (including Next API routes).

## Example

### Creating a use case

```ts
import { UseCase } from '@stompbox/spring-reverb'
import z from 'zod'

const inputSchema = z.object({ 
    firstName: z.string(), 
    lastName: z.string() 
})

const outputSchema = z.object({ 
    greetingText: z.string() 
})

class GreetingUseCase extends UseCase(
    inputSchema,
    outputSchema
) {
    // strongly-typed, with autocompletion
    async executeRaw(
        input: { firstName: string; lastName: string }
    ): Promise<{ greetingText: string; }> {
        const { firstName, lastName } = input

        return { 
            greetingText: `Hello, ${firstName} ${lastName}!` 
        }
    }
}

const greetingUseCase = new GreetingUseCase()

const { greetingText } = await greetingUseCase.execute({
    firstName: 'Player',
    lastName: 'one'
})
```

### Usage with Next

```ts
// app/api/some/path/route.ts

import { nextAdapter } from '@stompbox/spring-reverb/next'
import { GreetingUseCase } from '@/use-cases'

const adapter = nextAdapter(GreetingUseCase)({
    // strongly-typed, with autocompletion
    firstName: 'query',
    lastName: 'body'
})

const greetingUseCase = new GreetingUseCase()

export const PUT = greetingUseCase.withAdapter(
    adapter
)

/**
 * PUT /api/some/path?firstName=Player 
 * Body: { lastName: 'one' } 
 */ 
```
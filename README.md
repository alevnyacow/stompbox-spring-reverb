# Spring Reverb

Framework-agnostic plug-and-play handlers with adapters.

## Example

### Creating a handler

```ts
import { Handler } from '@stompbox/spring-reverb'
import z from 'zod'

const inputSchema = z.object({ 
    firstName: z.string(), 
    lastName: z.string() 
})

const outputSchema = z.object({ 
    greetingText: z.string() 
})

class GreetingUseCase extends Handler(
    inputSchema,
    outputSchema
) {
    // strongly-typed, with autocompletion
    async handleLoose(
        input: { firstName: string; lastName: string }
    ): Promise<{ greetingText: string; }> {
        return { 
            greetingText: `Hello, ${firstName} ${lastName}!` 
        }
    }
}

const greetingUseCase = new GreetingUseCase()

const { greetingText } = await greetingUseCase.handle({
    firstName: 'Player',
    secondName: 'one'
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
    secondName: 'body'
})

const greetingUseCase = new GreetingUseCase()

export const PUT = greetingUseCase.handleWithAdapter(
    adapter
)

/**
 * PUT /api/some/path?firstName=Player 
 * Body: { secondName: 'one' } 
 */ 
```
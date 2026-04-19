# Spring Reverb

Framework-agnostic plug-and-play use cases with built-in adapters for Next and Express.

## Example

### Creating a use case

```ts
import { createUseCase } from '@stompbox/spring-reverb'
import z from 'zod'

export const greet = createUseCase(
    // input schema
    z.object({
        firstName: z.string(), 
        lastName: z.string() 
    }),
    // output schema
    z.object({ 
        greetingText: z.string() 
    }),
    // strongly-typed handler
    async ({ firstName, lastName }) => {
        return {
            greetingText: `Hello, ${firstName} ${lastName}!`
        }
    }
)

const { greetingText } = await greet.execute({
    firstName: 'Player',
    lastName: 'one'
})
```

### Usage with Next

```ts
// app/api/some/path/route.ts

import { nextAdapter } from '@stompbox/spring-reverb/next'
import { greet } from '@/use-cases'

const adapter = nextAdapter(greet)({
    // strongly-typed, with autocompletion
    firstName: 'query',
    lastName: 'body'
})

export const PUT = greet.withAdapter(adapter)

/**
 * PUT /api/some/path?firstName=Player 
 * Body: { lastName: 'one' } 
 * 
 * => { greetingText: 'Hello, Player one!' }
 */ 
```

### Usage with Express

```ts
import { nextAdapter } from '@stompbox/spring-reverb/next'
import { greet } from '@/use-cases'

const adapter = expressAdapter(greet)({
    // strongly-typed, with autocompletion
    firstName: 'query',
    lastName: 'body',
});

app.put('/greet', (req, res) => {
    greet.withAdapter(adapter)({ req, res })
});

/**
 * PUT /greet?firstName=Player 
 * Body: { lastName: 'one' } 
 * 
 * => { greetingText: 'Hello, Player one!' }
 */ 
```
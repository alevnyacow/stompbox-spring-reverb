# Spring Reverb

Framework-agnostic plug-and-play handlers with built-in adapters for Next and Express.

## Example

### Creating a handler

```ts
import { springReverb } from '@stompbox/spring-reverb'
import z from 'zod'

export const greet = springReverb(
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

const result = await greet({
    firstName: 'Player',
    lastName: 'one'
})

/** 
 * safe approach with result of
 * | { failed: false, output: Output }
 * | { failed: true, error: Error }
 */
if (!result.failed) {
    console.log(result.output.greetingText)
} else {
    console.error(result.error)
}

/**
 * forced unwrap approach that can throw an exception
 */ 
try {
    const { greetingText } = result.unwrap()
} catch (e) {
    console.error(e)
}
```

### Usage with Next

```ts
// app/api/some/path/route.ts

import { withNextAdapter } from '@stompbox/spring-reverb/next'
import { greet } from '@/use-cases'

export const PUT = withNextAdapter(
    greet,
    {
        firstName: 'query', 
        lastName: 'body' 
    }
)

/**
 * PUT /api/some/path?firstName=Player 
 * Body: { lastName: 'one' } 
 * 
 * => { greetingText: 'Hello, Player one!' }
 */ 
```

### Usage with Express

```ts
import { withExpressAdapter } from '@stompbox/spring-reverb/express'
import { greet } from '@/use-cases'

app.put('/greet', withExpressAdapter(
    greet,
    {
        firstName: 'query',
        lastName: 'body',
    }
))

/**
 * PUT /greet?firstName=Player 
 * Body: { lastName: 'one' } 
 * 
 * => { greetingText: 'Hello, Player one!' }
 */ 
```
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
    // strongly-typed handler, can be also async
    ({ firstName, lastName }) => {
        return {
            greetingText: `Hello, ${firstName} ${lastName}!`
        }
    }
)

/** 
 * safe approach with result of
 * | { success: true, output: Output }
 * | { success: false, error: Error }
 */

const safeResult = await greet({
    firstName: 'Player',
    lastName: 'one'
})

if (safeResult.success) {
    console.log(safeResult.output.greetingText)
} else {
    console.error(safeResult.error)
}

/**
 * unsafe approach that can throw an exception
 */ 
try {
    const { greetingText } = await greet.unsafe({
        firstName: 'Player',
        lastName: 'one'
    })
    console.log(greetingText)
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
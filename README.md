# Spring Reverb

Framework-agnostic handlers with built-in adapters for Next and Express.

## Example

### Creating a handler

```ts
import { createHandler } from '@stompbox/spring-reverb'
import z from 'zod'

export const greet = createHandler({
    // input schema
    input: z.object({
        firstName: z.string(), 
        lastName: z.string() 
    }),
    // output schema
    output: z.object({ 
        greetingText: z.string() 
    }),
    // handler, can be async
    handler: ({ firstName, lastName }) => {
        return {
            greetingText: `Hello, ${firstName} ${lastName}!`
        }
    }
})

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

### Usage with Next.JS

```ts
// app/api/some/path/route.ts

import { nextAdapter } from '@stompbox/spring-reverb/next'
import type { EndpointContracts } from '@stompbox/spring-reverb'
import { greet } from '@/use-cases'

export const PUT = greet
    .REST(nextAdapter)
    .customSchema((inputSchema) => {
        return {
            querySchema: inputSchema.pick({ firstName: true }),
            bodySchema: inputSchema.omit({ firstName: true })
        }
    })


// request and response DTOs, can be used on client
/**
 * {
 *     requestDetails: {
 *         query: { firstName: string },
 *         body: { lastName: string }
 *     }
 *     requestDTO: { firstName: string, lastName: string },
 *     responseDTO: { greetingText: string }
 * }
 */
export type PUTEndpoint = EndpointContracts<typeof PUT>

/**
 * PUT /api/some/path?firstName=Player 
 * Body: { lastName: 'one' } 
 * 
 * => { greetingText: 'Hello, Player one!' }
 */ 
```

### Usage with Express

```ts
import { expressAdapter } from '@stompbox/spring-reverb/express'
import type { EndpointContracts } from '@stompbox/spring-reverb'
import { greet } from '@/use-cases'

export const PUT = greet
    .REST(expressAdapter)
    .customSchema((inputSchema) => {
        return {
            querySchema: inputSchema.pick({ firstName: true }),
            bodySchema: inputSchema.omit({ firstName: true })
        }
    })
)

export type PUTEndpoint = EndpointContracts<typeof PUT>

app.put('/greet', PUT)

/**
 * PUT /greet?firstName=Player 
 * Body: { lastName: 'one' } 
 * 
 * => { greetingText: 'Hello, Player one!' }
 */ 
```

### Creating a handler with context

```ts
import z from 'zod'
import { createHandler } from '@stompbox/spring-reverb'

const userSchema = z.object({
    id: z.string(), 
    name: z.string()
})

class UserRepository {
    findById = async (id: string): z.infer<userSchema> | null => {
        if (Math.random() > 0.5) {
            return { id, name: 'Dummy user' } 
        }
        return null
    }
}

const findUser = createHandler({
    input: z.string(),
    output: userSchema.nullable(),
    getContext: () => ({ userRepository: new UserRepository() }),   
    handler: async (id, ({ userRepository })) => {
        return userRepository.findById(id)
    }
})

const result = await findUser('test-id')
```
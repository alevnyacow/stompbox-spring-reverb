# Spring Reverb

Framework-agnostic handlers with built-in adapters for Next and Express.

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

import { nextAdapter } from '@stompbox/spring-reverb/next'
import type { EndpointDTOs } from '@stompbox/spring-reverb'
import { greet } from '@/use-cases'

export const PUT = nextAdapter(
    // handler
    greet,
    // description of API endpoint request
    (inputSchema) => ({
        querySchema: inputSchema.pick({ firstName: true }),
        bodySchema: inputSchema.pick({ lastName: true })
    }),
    // map API endpoint request to handler input
    x => x
)

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
export type PUTEndpoint = EndpointDTOs<typeof PUT>

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
import type { EndpointDTOs } from '@stompbox/spring-reverb'
import { greet } from '@/use-cases'

const PUT = expressAdapter(
    greet,
    // short-handed pick variant
    ({ pick }) => ({
        querySchema: pick({ firstName: true }),
        bodySchema: pick({ lastName: true })
    }),
    x => x
)

export type PUTEndpoint = EndpointDTOs<typeof PUT>

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
import { springReverbWithCtx } from '@stompbox/spring-reverb'

class UserRepository {
    findById = async (id: string) => {
        if (Math.random() > 0.5) {
            return { id, name: 'Dummy user' } 
        }
        return null
    }
}

const findUser = springReverbWithCtx(() => ({
    userRepository: new UserRepository()
}))(
    z.string(),
    z.object({ id: z.string(), name: z.string() }).nullable(),
    // context is strongly-typed
    async (id, { userRepository }) => {
        return userRepository.findById(id)
    }
)

const result = await findUser('test-id')
```

#### Usage with Tape Delay stompbox

```ts
import { TapeDelay } from '@stompbox/tape-delay'
import { tapeDelayContext } from '@stompbox/spring-reverb/tape-delay'

class RandomNumberGenerator {
    num = () => {
        return Math.random()
    }
}

class MathService {
    sum = (a: number, b: number) => a + b
}


const container = new TapeDelay({
    RandomNumberGenerator,
    MathService
})

const withTapeDelayCtx = tapeDelayContext(container)

const getRandomSum = withTapeDelayCtx(
    // strongly-typed keys
    'RandomNumberGenerator',
    'MathService'
)(
    z.number(),
    z.number(),
    // strongly-typed context
    (target, { randomNumberGenerator, mathService }) => {
        return mathService.sum(
            target, 
            randomNumberGenerator.num()
        )
    }
)

const result = await getRandomSum(42)
```
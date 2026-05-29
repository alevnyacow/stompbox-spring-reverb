# Spring Reverb

Framework-agnostic handlers with built-in adapters for Next and Express.

## Example

### Creating a handler

```ts
import { handler } from '@stompbox/spring-reverb'
import z from 'zod'

export const greet = handler({
    input: z.object({
        firstName: z.string(), 
        lastName: z.string(),
        greetingOptions: z.object({
            start: z.enum(['Hello', 'Hi'])
        })
    }),
    output: z.object({ 
        greetingText: z.string() 
    }),
    handler: ({ firstName, lastName, greetingOptions }) => {
        const start = `${greetingOptions.start}, `
        return {
            greetingText: `${start}${firstName} ${lastName}!`
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
    lastName: 'one',
    greetingOptions: {
        start: 'Hello'
    }
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
    const { greetingText } = await greet.orThrow({
        firstName: 'Player',
        lastName: 'one',
        greetingOptions: {
            start: 'Hello'
        }
    })
    console.log(greetingText)
} catch (e) {
    console.error(e)
}
```

### Usage with REST API (Next example)

#### Default schemas

By default, all primitives are passed via query parameters and all objects/arrays are passed via body.

```ts
// app/api/some/path/route.ts

import { nextAdapter } from '@stompbox/spring-reverb/next'
import type { EndpointContracts } from '@stompbox/spring-reverb'
import { greet } from '@/use-cases'

export const PUT = greet.REST(nextAdapter)

// request and response DTOs, can be used on client
/**
 * {
 *     requestDetails: {
 *         query: { 
 *             lastName: string, 
 *             firstName: string 
 *         },
 *         body: { 
 *             greetingOptions: { 
 *                 start: 'Hello' | 'Hi'
 *             } 
 *         }
 *     },
 *     requestDTO: { 
 *         firstName: string, 
 *         lastName: string,
 *         greetingOptions: {
 *             start: 'Hello' | 'Hi'
 *         }
 *     },
 *     responseDTO: { 
 *         greetingText: string 
 *     }
 * }
 */
export type PUTEndpoint = EndpointContracts<typeof PUT>

/**
 * PUT /api/some/path?firstName=Player&lastName=one
 * 
 * Body:
 * ```
 * { greetingOptions: { start: 'Hello' } }
 * ```
 * 
 * => { greetingText: 'Hello, Player one!' }
 */ 
```

#### Custom schemas

```ts
// app/api/some/path/route.ts

import { nextAdapter } from '@stompbox/spring-reverb/next'
import type { EndpointContracts } from '@stompbox/spring-reverb'
import { greet } from '@/use-cases'

export const PUT = greet.REST(nextAdapter).customSchema(
    (inputSchema) => {
        return {
            query: inputSchema
                .omit({ greetingOptions: true })
                .extend({ 
                    greetingWord: z.enum(['Hello', 'Hi'])
                })
        }
    },
    (x) => ({
        firstName: x.firstName,
        lastName: x.lastName,
        greetingOptions: {
            start: x.greetingWord
        }
    })
)

// request and response DTOs, can be used on client
/**
 * {
 *     requestDetails: {
 *         query: { 
 *             lastName: string, 
 *             firstName: string,
 *             greetingWord: 'Hello' | 'Hi'
 *         },
 *     },
 *     requestDTO: { 
 *         firstName: string, 
 *         lastName: string,
 *         greetingWord: 'Hello' | 'Hi'
 *     },
 *     responseDTO: { 
 *         greetingText: string 
 *     }
 * }
 */
export type PUTEndpoint = EndpointContracts<typeof PUT>

/**
 * PUT /api/some/path?firstName=Player&lastName=one&greetingWord=Hi
 * 
 * => { greetingText: 'Hi, Player one!' }
 */ 
```

### Creating a handler with context

```ts
import z from 'zod'
import { handlerWithCtx } from '@stompbox/spring-reverb'

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

const findUserWithCtx = handlerWithCtx({
    input: z.string(),
    output: userSchema.nullable(),
    handler: async (id, (ctx: { userRepository: UserRepository })) => {
        return ctx.userRepository.findById(id)
    }
})

// You can pass context as object.
const findUser = findUserWithCtx({ 
    userRepository: new UserRepository() 
})
/**
 * Or you can pass generator
 * const findUser = findUserWithCtx(() => ({ 
 *     userRepository: new UserRepository()
 * }))
 */ 
 
const result = await findUser('test-id')

const findUserREST = findUser.REST(/* adapter */)
```

### Middlewares

```tsx
const upperCaseWithCtx = newHandlerWithCtx({
  input: z.object({ string: z.string(), secondString: z.string() }),
  output: z.object({ stringInUpperCase: z.string() }),
  handler: ({ secondString, string }, ctx: { isLoggedIn: boolean }) => { 
    if (string === 'THROW_ERROR') {
      throw new TestError('test')
    }
    return { stringInUpperCase: `${string.toUpperCase()} ${secondString.toUpperCase()}` } 
  },
  middlewares: {
    beforeHandler: [
      async ({ parsedInput, context }) => {
        console.log('before', parsedInput)
        if (!context.isLoggedIn) {
          throw new Error('Not logged in!')
        }
      }
    ],
    afterHandler: [
      async ({ context, output, parsedInput }) => {
        console.log('after', context, output, parsedInput)
      }
    ],
    onError: [
      async (error) => {
        console.error('ERROR HAPPENED', error)
      }
    ]
  }
})

const upperCase = upperCaseWithCtx(
    () => ({
        isLoggedIn: Math.random() > 0.5
    })
)
```

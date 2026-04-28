import { expect, test } from '@rstest/core';
import { createHandler } from '../src/handler'
import z from 'zod';
import { NextRequest } from 'next/server';
import { nextAdapter } from '../src/next'
import express from 'express'
import { expressAdapter } from '../src/express'
import { EndpointContracts } from '../src/api-adapter-types';
import { newContainer } from '@stompbox/tape-delay';

const upperCase = createHandler({
  input: z.object({ string: z.string(), secondString: z.string() }),
  output: z.object({ stringInUpperCase: z.string() }),
  handler: ({ secondString, string }) => { 
    return { stringInUpperCase: `${string.toUpperCase()} ${secondString.toUpperCase()}` } 
  }
})

test('Express adapter', async () => {
  const app = express();

  const expressEndpoint = upperCase.REST(expressAdapter).allInQuery()
  
  app.get('/', expressEndpoint);

  type A = EndpointContracts<typeof expressEndpoint>

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const port = (server.address() as any).port;

  const result = await fetch(
    `http://localhost:${port}?string=hello&secondString=world`
  );

  const json = await result.json();

  expect(json).toEqual({ stringInUpperCase: 'HELLO WORLD' })

  server.close();
});

test('Next adapter', async () => {
  const NextRoute = upperCase.REST(nextAdapter).customSchema(({pick, omit}) => {
    return {
      bodySchema: pick({ secondString: true }),
      querySchema: omit({ secondString: true }),
    }
  })

  type A = EndpointContracts<typeof NextRoute>

  const data = await NextRoute(new NextRequest('http://localhost.mock.url:3000?string=hello', {
    body: JSON.stringify({ secondString: 'world' }),
    method: 'POST'
  }))
  const body = await data.json()
  expect(body).toEqual({stringInUpperCase: 'HELLO WORLD'})
});

test('Tape delay', async () => {
  class RandomNumber { getNumber = () => Math.random() }
  const container = newContainer({ RandomNumber })

  const f = createHandler({
    input: z.number(),
    output: z.number(),
    getContext: container.resolve,
    handler: (i, ctx) => i + ctx.randomNumber.getNumber()
  })

  const result = await f.unsafe(2)

  expect(result).toBeGreaterThan(2)
  expect(result).toBeLessThan(3)
})
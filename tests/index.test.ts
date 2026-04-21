import { expect, test } from '@rstest/core';
import { springReverb } from '../src/handler'
import z from 'zod';
import { NextRequest } from 'next/server';
import { nextAdapter } from '../src/next'
import express from 'express'
import { expressAdapter } from '../src/express'
import { TapeDelay } from '@stompbox/tape-delay';
import { tapeDelayContext } from '../src/tape-delay';

const upperCase = springReverb(
  z.object({ string: z.string(), secondString: z.string() }),
  z.object({ stringInUpperCase: z.string() }),
  (x) => ({ stringInUpperCase: `${x.string.toUpperCase()} ${x.secondString.toUpperCase()}` })
)

test('Express adapter', async () => {
  const app = express();
  
  app.get('/', expressAdapter(upperCase, {
    secondString: 'query',
    string: 'query'
  }));

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
  const NextRoute = nextAdapter(upperCase, { string: 'query', secondString: 'body' })

  const data = await NextRoute(new NextRequest('http://localhost.mock.url:3000?string=hello', {
    body: JSON.stringify({ secondString: 'world' }),
    method: 'POST'
  }))
  const body = await data.json()
  expect(body).toEqual({stringInUpperCase: 'HELLO WORLD'})
});

test('Tape delay', async () => {
  class S { sayHi = () => 'hi' }
  const f = new TapeDelay({S})
  const t = await tapeDelayContext(f)('S')(
    z.number(), z.string(),
    (input, { s }) => {
      return input + ' ' + s.sayHi()
    }
  ).unsafe(22)
  expect(t).toBe('22 hi')
})
import { expect, test } from '@rstest/core';
import { springReverb, withAdapter } from '../src/handler'
import z from 'zod';
import { NextRequest } from 'next/server';
import { withNextAdapter } from '../src/next'
import express from 'express'
import { withExpressAdapter } from '../src/express'

const handler = springReverb(
  z.object({ string: z.string(), secondString: z.string() }),
  z.object({ stringInUpperCase: z.string() }),
  (x) => ({ stringInUpperCase: `${x.string.toUpperCase()} ${x.secondString.toUpperCase()}` })
)

test('Express adapter', async () => {
  const app = express();
  
  app.get('/', withExpressAdapter(handler, {
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
  const NextRoute = withNextAdapter(handler, { string: 'query', secondString: 'body' })

  const data = await NextRoute(new NextRequest('http://localhost.mock.url:3000?string=hello', {
    body: JSON.stringify({ secondString: 'world' }),
    method: 'POST'
  }))
  const body = await data.json()
  expect(body).toEqual({stringInUpperCase: 'HELLO WORLD'})
});

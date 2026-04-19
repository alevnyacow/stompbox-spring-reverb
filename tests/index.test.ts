import { expect, test } from '@rstest/core';
import { UseCase } from '../src/handler'
import z from 'zod';
import { NextRequest } from 'next/server';
import { nextAdapter } from '../src/next'
import express from 'express'
import { expressAdapter } from '../src/express'


class UpperCaseHandler extends UseCase(z.object({ string: z.string(), secondString: z.string() }), z.object({ stringInUpperCase: z.string() })) {
  async executeRaw(input: { string: string; secondString: string }): Promise<{ stringInUpperCase: string; }> {
    return {
      stringInUpperCase: input.string.toUpperCase() + ' ' + input.secondString.toUpperCase()
    }
  }
}

test('Express adapter', async () => {
  const app = express();
  
  const handler = new UpperCaseHandler();

  const adapter = expressAdapter(handler)({
    secondString: 'query',
    string: 'query',
  });

  app.get('/', (req, res) =>
    handler.withAdapter(adapter)({ req, res })
  );

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
  const adapter = nextAdapter(UpperCaseHandler)({ string: 'query', secondString: 'body' })
  const handler = new UpperCaseHandler()
  const NextRoute = handler.withAdapter(adapter)

  const data = await NextRoute(new NextRequest('http://localhost.mock.url:3000?string=hello', {
    body: JSON.stringify({ secondString: 'world' }),
    method: 'POST'
  }))
  const body = await data.json()
  expect(body).toEqual({stringInUpperCase: 'HELLO WORLD'})
});

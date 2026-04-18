import { expect, test } from '@rstest/core';
import { UseCase } from '../src/handler'
import { nextAdapter } from '../src/next'
import z from 'zod';
import { NextRequest } from 'next/server';

test('Next adapter', async () => {
  class UpperCaseHandler extends UseCase(z.object({ string: z.string(), secondString: z.string() }), z.object({ stringInUpperCase: z.string() })) {
    async executeRaw(input: { string: string; secondString: string }): Promise<{ stringInUpperCase: string; }> {
      return {
        stringInUpperCase: input.string.toUpperCase() + ' ' + input.secondString.toUpperCase()
      }
    }
  }

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

import { expect, test } from '@rstest/core';
import { Handler } from '../src/handler'
import { nextAdapter } from '../src/next'
import z from 'zod';
import { NextRequest } from 'next/server';
// import { squared } from '../src/index';

test('squared', async () => {
  class S extends Handler(z.object({ string: z.string() }), z.object({ stringInUpperCase: z.string() })) {
    async handleLoose(input: { string: string; }): Promise<{ stringInUpperCase: string; }> {
      return {
        stringInUpperCase: input.string.toUpperCase()
      }
    }
  }

  const GET = new S().handleWithAdapter(nextAdapter(S)({ string: 'query' }))

  const data = await GET(new NextRequest('http://localhost.mock.url:3000?string=hello'))
  const body = await data.json()
  expect(body).toEqual({stringInUpperCase: 'HELLO'})
});

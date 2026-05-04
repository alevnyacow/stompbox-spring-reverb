import { NextRequest, NextResponse } from 'next/server'
import { APIDataAdapter } from './api-adapter-types'
import { commonDetails } from '@stompbox/limiter'

/**
 * Plain `jsonResponse` working without NextResponse extension. 
 * 
 * @param data response data
 * @param init response initialization
 * @returns Response object can be sent to a client
 */
function jsonResponse<T>(data: T, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  }) as any
}


export const nextAdapter: APIDataAdapter<[request: NextRequest], NextResponse> = {
    dataObtainer: async (request) => {
        let body = {}
        try {
            body = await request.json() as object
        } catch (e) {

        }

        let query = {}
        try {
            query = Object.fromEntries(
                request.nextUrl.searchParams.entries()
            );
        } catch(e) {

        }

        return { body, query }
    },
    responseMapper: (x) => {
        if (x.success) {
            return jsonResponse(x.output)
        }
        const errorCode = commonDetails(x.error).responseStatusCode ?? 500

        return jsonResponse(errorCode.toString().startsWith('4') ? x.error : {}, { status: errorCode })
    }
}
import { Request, Response } from 'express'
import { APIDataAdapter } from './api-adapter-types'
import { commonDetails } from '@stompbox/limiter'

export const expressAdapter: APIDataAdapter<[req: Request, res: Response], void> = {
    dataObtainer: (req) => {
        return {
            query: req.query || {},
            body: req.body || {}
        }
    },
    responseMapper: (response, _req, res) => {
        if (response.success) {
            res.send(response.output)
            return
        }

        const errorCode = commonDetails(response.error).responseStatusCode ?? 500

        res.status(errorCode).send(errorCode.toString().startsWith('4') ? response.error : {})
    }
}
import { Request, Response } from 'express'
import { APIDataAdapter } from './api-adapter-types'

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
        res.status(500).send(response.error)
    }
}
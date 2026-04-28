import z, { ZodObject, ZodString } from "zod"
import { SpringReverbHandlerResponse } from "./handler"

export type APIInputSchemas<
    InputSchema extends ZodObject, 
    QuerySchema extends ZodObject<Record<string, ZodString>> | undefined, 
    BodySchema extends ZodObject | undefined
> = ((
    inputSchema: InputSchema,
) => 
    (QuerySchema extends undefined ? { } : { querySchema: QuerySchema }) 
    & 
    (BodySchema extends undefined ? { } : { bodySchema: BodySchema })) 


type WithAPIMetadata<QuerySchema extends ZodObject<Record<string, ZodString>> | undefined, BodySchema extends ZodObject | undefined, Response extends ZodObject> = {
    ___api_metadata: { querySchema?: QuerySchema, bodySchema?: BodySchema, response: Response }
}

export type EndpointContracts<Metadata extends WithAPIMetadata<any, any, any>> = {
    requestDetails: {
        body: z.infer<Metadata['___api_metadata']['bodySchema']>,
        query: z.infer<Metadata['___api_metadata']['querySchema']>,
    },
    requestDTO: z.infer<Metadata['___api_metadata']['bodySchema']> & z.infer<Metadata['___api_metadata']['querySchema']>,
    responseDTO: z.infer<Metadata['___api_metadata']['response']>,
}

type APIRequestDataObtainer<
    Input extends unknown[]
> = (...input: Input) => { query: object, body: object } | Promise<{query: object, body: object}>


export type APIDataAdapter<Input extends unknown[], Output> = {
    dataObtainer: APIRequestDataObtainer<Input>,
    responseMapper: (x: SpringReverbHandlerResponse<any>, ...input: Input) => Output | Promise<Output>
}
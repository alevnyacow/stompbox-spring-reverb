import z, { ZodObject, ZodString } from "zod"

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


export type WithAPIMetadata<QuerySchema extends ZodObject<Record<string, ZodString>>, BodySchema extends ZodObject, Response extends ZodObject> = {
    ___api_metadata: { querySchema?: QuerySchema, bodySchema?: BodySchema, response: Response }
}

export type EndpointDTOs<Metadata extends WithAPIMetadata<any, any, any>> = {
    requestDetails: {
        body: z.infer<Metadata['___api_metadata']['bodySchema']>,
        query: z.infer<Metadata['___api_metadata']['querySchema']>,
    },
    requestDTO: z.infer<Metadata['___api_metadata']['bodySchema']> & z.infer<Metadata['___api_metadata']['querySchema']>,
    responseDTO: z.infer<Metadata['___api_metadata']['response']>,
}
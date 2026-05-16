import z, { ZodBoolean, ZodDate, ZodNumber, ZodObject, ZodString } from "zod";
import { SpringReverbHandlerResponse } from "./handler";

export type APIInputSchemas<
    InputSchema extends ZodObject,
    QuerySchema extends ZodObject<Record<string, ZodString>> | undefined,
    BodySchema extends ZodObject | undefined,
> = (
    inputSchema: InputSchema,
) => (QuerySchema extends undefined ? {} : { querySchema: QuerySchema }) &
    (BodySchema extends undefined ? {} : { bodySchema: BodySchema });

type WithAPIMetadata<
    QuerySchema extends ZodObject<Record<string, ZodString>> | undefined,
    BodySchema extends ZodObject | undefined,
    Response extends ZodObject,
> = {
    ___api_metadata: {
        querySchema?: QuerySchema;
        bodySchema?: BodySchema;
        response: Response;
    };
};

export type EndpointContracts<Metadata extends WithAPIMetadata<any, any, any>> =
    {
        requestDetails: (unknown extends z.infer<
            Metadata["___api_metadata"]["bodySchema"]
        >
            ? {}
            : { body: z.infer<Metadata["___api_metadata"]["bodySchema"]> }) &
            (unknown extends z.infer<Metadata["___api_metadata"]["querySchema"]>
                ? {}
                : {
                      query: z.infer<
                          Metadata["___api_metadata"]["querySchema"]
                      >;
                  });
        requestDTO: z.infer<Metadata["___api_metadata"]["bodySchema"]> &
            z.infer<Metadata["___api_metadata"]["querySchema"]>;
        responseDTO: z.infer<Metadata["___api_metadata"]["response"]>;
    };

export type ControllerContracts<
    T extends Record<string, WithAPIMetadata<any, any, any>>,
> = {
    [method in keyof T]: EndpointContracts<T[method]>;
};

type APIRequestDataObtainer<Input extends unknown[]> = (
    ...input: Input
) => { query: object; body: object } | Promise<{ query: object; body: object }>;

export type APIDataAdapter<Input extends unknown[], Output> = {
    dataObtainer: APIRequestDataObtainer<Input>;
    responseMapper: (
        x: SpringReverbHandlerResponse<any>,
        ...input: Input
    ) => Output | Promise<Output>;
};

type StringKeys<T> = {
    [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

type NumericKeys<T> = {
    [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

type BooleanKeys<T> = {
    [K in keyof T]: T[K] extends boolean ? K : never;
}[keyof T];

type DateKeys<T> = {
    [K in keyof T]: T[K] extends Date ? K : never;
}[keyof T];

export type PrimitiveZodSchemaPart<T extends ZodObject> =
    | StringKeys<z.infer<T>>
    | NumericKeys<z.infer<T>>
    | BooleanKeys<z.infer<T>>
    | DateKeys<z.infer<T>> extends never
    ? never
    : ZodObject<
          Record<StringKeys<z.infer<T>>, ZodString> &
              Record<NumericKeys<z.infer<T>>, ZodNumber> &
              Record<BooleanKeys<z.infer<T>>, ZodBoolean> &
              Record<DateKeys<z.infer<T>>, ZodDate>
      >;

export type ComplexZodSchemaKeys<T extends ZodObject> = Exclude<
    keyof z.infer<T>,
    keyof PrimitiveZodSchemaPart<T>["shape"]
>;

export type ComplexZodSchemaPart<T extends ZodObject> =
    T extends ZodObject<infer Shape>
        ? ComplexZodSchemaKeys<T> extends never
            ? never
            : // @ts-ignore
              ZodObject<Pick<Shape, ComplexZodSchemaKeys<T>>>
        : never;

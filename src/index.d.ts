declare namespace NodeJS {
    interface ProcessEnv {
        readonly ZOOM: string
        readonly AWS_DYNAMODB_API_KEY_TABLE_NAME: string
        readonly INCREMENTP_VERIFICATION_API_ENDPOINT: string
        readonly INCREMENTP_VERIFICATION_API_KEY: string
    }
}

declare namespace EstateAPI {
    export type LambdaHandler = (event: import('aws-lambda').APIGatewayProxyEvent, context: any, callback: import('aws-lambda').APIGatewayProxyCallback) => void
}

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

declare global {
  interface PublicHandlerEvent extends APIGatewayProxyEvent {
    preauthenticatedUserId?: string
    isDemoMode?: boolean
    isDebugMode?: boolean
  }

  interface AdminHandlerEvent extends APIGatewayProxyEvent {
    userId: string
  }

  type AdminHandler = (event: AdminHandlerEvent) => Promise<APIGatewayProxyResult>

  namespace NodeJS {
    export interface ProcessEnv {
      readonly STAGE: "local" | "v1" | "dev"
      readonly ZOOM: string
      readonly AWS_DYNAMODB_API_KEY_TABLE_NAME: string
      readonly AWS_DYNAMODB_ESTATE_ID_TABLE_NAME: string
      readonly AWS_DYNAMODB_LOG_TABLE_NAME: string
      readonly ACCESS_TOKEN_SALT: string
      readonly INCREMENTP_VERIFICATION_API_ENDPOINT: string
      readonly INCREMENTP_VERIFICATION_API_KEY: string
    }
  }
}

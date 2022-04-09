import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, Callback } from 'aws-lambda';
declare global {

  type AuthenticationPlanIdentifier = 'paid' | 'free';

  type QuotaType = 'id-req' | 'id-query';

  type AuthenticationResult = {
    valid: true
    plan: AuthenticationPlanIdentifier,
    quotaLimit: number,
    quotaRemaining: number,
    quotaResetDate: string | false
  };

  interface PublicHandlerEvent extends APIGatewayProxyEvent {
    preauthenticatedUserId?: string
    isDemoMode?: boolean
    isDebugMode?: boolean
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface PropIdSubcontext {}

  interface PropIdContext<T extends PropIdSubcontext> extends Context {
    propId: T
  }

  type PropIdHandler<T = any> = ((event: PublicHandlerEvent, context: PropIdContext<T>, callback: Callback) => Promise<APIGatewayProxyResult>);

  interface AdminHandlerEvent extends APIGatewayProxyEvent {
    userId: string
  }

  type AdminHandler = (event: AdminHandlerEvent) => Promise<APIGatewayProxyResult>;

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    export interface ProcessEnv {
      readonly STAGE: 'local' | 'v1' | 'dev'
      readonly ZOOM: string
      readonly AWS_DYNAMODB_API_KEY_TABLE_NAME: string
      readonly AWS_DYNAMODB_ESTATE_ID_TABLE_NAME: string
      readonly AWS_DYNAMODB_LOG_TABLE_NAME: string
      readonly AWS_S3_LOG_STREAM_OUTPUT_BUCKET_NAME: string
      readonly ACCESS_TOKEN_SALT: string
      readonly INCREMENTP_VERIFICATION_API_ENDPOINT: string
      readonly INCREMENTP_VERIFICATION_API_KEY: string
    }
  }
}

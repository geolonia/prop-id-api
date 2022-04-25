// @file Lambda decorator definitions

import { APIGatewayProxyHandler, Context } from 'aws-lambda';
import { authenticateEvent, extractApiKey } from './authentication';

export type Decorator = (handler: PropIdHandler) => PropIdHandler;
export interface LoggerContext extends Context {
  propIdLogger: {
    background: Promise<any>[]
  }
};
export const logger: Decorator = (handler) => {
  return async(event, context, callback) => {
    const nextContext: LoggerContext = {
      ...context,
      propIdLogger: {
        background: [],
      },
    };
    const result = await handler(event, nextContext, callback);
    await Promise.all(nextContext.propIdLogger.background);
    return result;
  };
};

export interface AuthenticatorContext extends Context {
  propIdAuthenticator: {
    apiKey?: string
    accessToken?: string
    authentication: AuthenticationResult
    quotaParams: Pick<AuthenticationResult, 'quotaLimit' | 'quotaRemaining' | 'quotaResetDate'>
  }
}
export const authenticator =(quotaType: QuotaType): Decorator => (handler) => {
  return async (event, context, callback) => {
    const authentication = await authenticateEvent(event, quotaType);
    if ('statusCode' in authentication) {
      return authentication;
    }
    const { apiKey, accessToken } = extractApiKey(event);
    const quotaParams = {
      quotaLimit: authentication.quotaLimit,
      quotaRemaining: authentication.quotaRemaining,
      quotaResetDate: authentication.quotaResetDate,
    };
    const authenticatedContext: AuthenticatorContext = {
      ...context,
      propIdAuthenticator: {
        apiKey,
        accessToken,
        authentication,
        quotaParams,
      },
    };
    return handler(event, authenticatedContext, callback);
  };
};

export const decorate = (handler: PropIdHandler, decorators: (Decorator)[]): APIGatewayProxyHandler => {
  return decorators.reduce<PropIdHandler>((prev, decorator) => {
    const nextHandler = decorator(prev);
    return nextHandler;
  }, handler);
};

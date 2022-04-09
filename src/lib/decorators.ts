// @file Lambda decorator definitions

import { APIGatewayProxyHandler } from 'aws-lambda';
import { authenticateEvent, extractApiKey } from './authentication';

export type Decorator<
  T extends PropIdSubcontext,
> = (handler: PropIdHandler<N>) => PropIdHandler<T>;
export interface LoggerSubcontext extends PropIdSubcontext {
  logger: {
    background: Promise<void>[]
  }
};
export const logger: Decorator<LoggerSubcontext> = (handler) => {
  return async(event, context, callback) => {
    const nextContext: PropIdContext<LoggerSubcontext> = {
      ...context,
      propId: {
        ...(context.propId || {}),
        logger: {
          background: [],
        },
      },
    };
    const result = await handler(event, nextContext, callback);
    await Promise.all(nextContext.propId.logger.background);
    return result;
  };
};

export interface AuthenticatorSubcontext extends PropIdSubcontext {
  authenticator: {
    apiKey?: string
    accessToken?: string
    authentication: AuthenticationResult
    quotaParams: Pick<AuthenticationResult, 'quotaLimit' | 'quotaRemaining' | 'quotaResetDate'>
  }
}
export const authenticator = (quotaType: QuotaType): Decorator<AuthenticatorSubcontext> => (handler) => {
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
    const authenticatedContext: PropIdContext<AuthenticatorSubcontext> = {
      ...context,
      propId: {
        ...(context.propId || {}),
        authenticator: {
          apiKey,
          accessToken,
          authentication,
          quotaParams,
        },
      },
    };
    return handler(event, authenticatedContext, callback);
  };
};

export const decorate = <
  T extends readonly Decorator<X>[],
  X extends PropIdSubcontext[],
>(handler: PropIdHandler<X[number]>, decorators: T): APIGatewayProxyHandler => {
  return decorators.reduce((prev, decorator) => {
    const nextHandler = decorator(prev);
    return nextHandler;
  }, handler) as unknown as APIGatewayProxyHandler;
};

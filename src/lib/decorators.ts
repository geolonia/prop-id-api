// @file Lambda decorators

import { Handler } from 'aws-lambda';
import { authenticateEvent, extractApiKey } from './authentication';

type QuotaType = 'id-req';

export const authenticator = (quotaType: QuotaType) => (handler: PropIdHandler): PropIdHandler => {
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
    const background = context?.propId?.background || [];
    const authenticatedContext = {
      ...(context || {}),
      propId: {
        apiKey,
        accessToken,
        authentication,
        quotaParams,
        background,
      },
    };
    return handler(event, authenticatedContext, callback);
  };
};

export const log = (handler: PropIdHandler): PropIdHandler => {
  return async(event, context, callback) => {
    const background = context?.propId?.background || [];
    const loggerContext = {
      ...context,
      propId: {
        ...context.propId,
        background,
      },
    };
    const result = await handler(event, loggerContext, callback);
    await Promise.all(loggerContext.propId.background);
    return result;
  };
};

export type Decorator = ((handler: PropIdHandler, ...args: any[]) => PropIdHandler);

export const decorate = (
  handler: PropIdHandler,
  wrappers: Decorator[],
): Handler => {
  return wrappers.reduce<PropIdHandler>((prev, wrapper) => {
    return wrapper(prev);
  }, handler) as Handler;
};

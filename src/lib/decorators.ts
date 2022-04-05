// @file Lambda decorators

import { authenticateEvent, extractApiKey } from './authentication';

type QuotaType = 'id-req';

export const authenticator = (handler: PropIdHandler, quotaType: QuotaType): PropIdHandler => {
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
    const authenticatedContext = {
      ...context,
      propId: {
        apiKey,
        accessToken,
        authentication,
        quotaParams,
        background: [...context.propId.background || []],
      },
    };
    return handler(event, authenticatedContext, callback);
  };
};

export const log = (handler: PropIdHandler): PropIdHandler => {
  return async(event, context, callback) => {
    const loggerContext = {
      ...context,
      propId: {
        ...context.propId,
        background: [...context.propId.background],
      },
    };
    const result = await handler(event, loggerContext, callback);
    await Promise.all(loggerContext.propId.background);
    return result;
  };
};

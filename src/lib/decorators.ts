// @file Lambda decorators

import { Handler } from 'aws-lambda';
import { authenticateEvent, extractApiKey } from './authentication';

type QuotaType = 'id-req';

export const authenticator = (handler: PropIdHandler, quotaType: QuotaType): Handler => {
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
      },
    };
    return handler(event, authenticatedContext, callback);
  };
};

import { errorResponse, json } from '../lib/proxy-response';
import { joinNormalizeResult, normalize } from '../lib/nja';
import { normalizeBanchiGo, addBanchiGo } from '../lib/dynamodb_logs';


export const _addBanchiGoHandler: PropIdHandler = async (event) => {

  // const {
  //   propIdAuthenticator: { authentication, quotaParams },
  //   propIdLogger: { background },
  // } = context as AuthenticatorContext & LoggerContext;

  const { pref, city, town, addr, lat, lng } = JSON.parse(event.body || '');

  if (
    [pref, city, town, addr].some((val) => !val || typeof val !== 'string') ||
    [lat, lng].some((val) => typeof val !== 'number')
  ) {
    return errorResponse(400, 'Invalid address request body.');
  }
  const address = joinNormalizeResult({ pref, city, town, addr });
  const normalizeResult = await normalize(address);

  if (normalizeResult.level < 3) {
    return errorResponse(400, `Not normalized address, ${address}.`);
  }

  const { level } = await normalizeBanchiGo(normalizeResult);
  if (level < 7) {
    await addBanchiGo({ pref, city, town, addr, lat, lng, status: 'addressPending' });
    return json({ success: true });
  } else {
    return json({ message: 'already exists.' });
  }

};

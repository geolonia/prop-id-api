import fs from 'fs/promises'
import axios from 'axios'

const { STAGE = 'dev'} = process.env


const main = async () => {
  const input = await (await fs.readFile("/dev/stdin", "utf8")).replace('\n', '');
  const result = await verifyAddress(input)
  console.log(result.body.features)
}

main()

export const verifyAddress = async (addressListString: string) => {
  // Use first address
  const addresses = addressListString.split(';');
  const address = addresses[0] || '';
  const endpoint = process.env.INCREMENTP_VERIFICATION_API_ENDPOINT as string;
  const apiKey = process.env.INCREMENTP_VERIFICATION_API_KEY as string;
  const url = `${endpoint}/${encodeURIComponent(address)}.json?geocode=true`;
  const headers = {
    'x-api-key': apiKey,
    'user-agent': 'geolonia-prop-id/1.0',
  };

  const res = await axios.get(url, {
    headers,
    validateStatus: (status) => ( status < 500 ),
  });

  return ({
    body: res.data,
    status: res.status,
    ok: res.status === 200,
    headers: res.headers,
  });
};

import { _handler as publicHandler } from '../public'
import { _queryHandler as idQueryHandler } from './queryHandler';
import { _splitHandler as idQuerySplitHandler } from './splitHandler';

jest.setTimeout(15 * 1000)

const context = {
  propIdAuthenticator: { authentication: { plan: 'paid' } },
  propIdLogger: { background: [] },
}

test.only('should generate new ID from that of existing.', async () => {
  // 以下の4ステップで正しく idObject が返却されているかをテストしている
  // 1. ID を発行
  // 2. ID を分割
  // 3. 全ての ID を住所でクエリ
  // 4. ID を個別にクエリ

  // 1. ID を発行
  const event1 = {
    isDemoMode: true,
    queryStringParameters: {
      q: '滋賀県大津市京町４丁目１−１こんにちはビルA棟',
    },
  };
  // @ts-ignore
  const lambdaResult1 = await publicHandler(event1, context) as APIGatewayProxyResult
  expect(lambdaResult1.statusCode).toBe(200);
  const [idObj1] = JSON.parse(lambdaResult1.body);

  // 2. ID を分割
  const event2 = {
    isDemoMode: true,
    pathParameters: {
      estateId: idObj1.ID,
    },
    queryStringParameters: {
      lat: '35.1234',
      lng: '135.1234',
      building: 'こんにちはビルB棟',
    },
    body: JSON.stringify({
      feedback: {
        currentAddress: 'test',
        idSplit: {},
      }
    }),
  };
  // @ts-ignore
  const lambdaResult2 = await idQuerySplitHandler(event2, context) as APIGatewayProxyResult;
  expect(lambdaResult2.statusCode).toBe(200);
  const [idObj2] = JSON.parse(lambdaResult2.body);
  expect(typeof idObj2.ID === 'string').toBeTruthy();
  expect(idObj2.ID).not.toBe(idObj1.ID);
  expect(idObj2.status).toEqual('addressPending');

  // 3. 全ての ID を住所でクエリ
  const event3 = {
    isDemoMode: true,
    queryStringParameters: {
      q: '滋賀県大津市京町４丁目１−１',
    },
  };
  // @ts-ignore
  const lambdaResult3 = await publicHandler(event3, context) as APIGatewayProxyResult;
  expect(lambdaResult3.statusCode).toBe(200);
  const idObjects3 = JSON.parse(lambdaResult3.body);
  expect(idObjects3).toHaveLength(2);
  if (idObjects3[0].ID === idObj1.ID) {
    expect(idObjects3[0].address.ja).toMatchObject(idObj1.address.ja);
    expect(idObjects3[1].address.ja).toMatchObject(idObj2.address.ja);
  } else {
    expect(idObjects3[0].address.ja).toMatchObject(idObj2.address.ja);
    expect(idObjects3[1].address.ja).toMatchObject(idObj1.address.ja);
  }

  // ID を個別にクエリ
  const [event4, event5] = idObjects3.map((idObj: any) => ({
    isDemoMode: true,
    pathParameters: {
      estateId: idObj.ID,
    },
  }));

  // @ts-ignore
  const [lambdaResult4, lambdaResult5] = await Promise.all([
    // @ts-ignore
    idQueryHandler(event4, context),
    // @ts-ignore
    idQueryHandler(event5, context),
  ]);
  // @ts-ignore
  expect(lambdaResult4.statusCode).toBe(200);
  // @ts-ignore
  expect(lambdaResult5.statusCode).toBe(200);
  // @ts-ignore
  const [idObj4] = JSON.parse(lambdaResult4.body);
  // @ts-ignore
  const [idObj5] = JSON.parse(lambdaResult5.body);

  if (idObj4.ID === idObj1.ID) {
    expect(idObj4.address.ja).toMatchObject(idObj1.address.ja);
  } else {
    expect(idObj5.address.ja).toMatchObject(idObj1.address.ja);
  }

  if (idObj5.ID === idObjects3[0].ID) {
    expect(idObj5.address.ja).toMatchObject(idObjects3[0].address.ja);
    expect(idObj4.address.ja).toMatchObject(idObjects3[1].address.ja);
  } else {
    expect(idObj5.address.ja).toMatchObject(idObjects3[1].address.ja);
    expect(idObj4.address.ja).toMatchObject(idObjects3[0].address.ja);
  }
});

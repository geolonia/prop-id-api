import * as dynamodb from './dynamodb'

describe('mergeEstateId', () => {
  test('it works', async () => {
    const destId = await dynamodb.store({
      address: "test",
      tileXY: "3726576/1649777",
      zoom: 22,
      prefCode: "11"
    })

    const origId = "11-0000-0000-0000-0000"

    const mergeResp = await dynamodb.mergeEstateId({
      from: [origId],
      to: destId.estateId,
    })

    expect(mergeResp.error).toBe(false)
    if (mergeResp.error) {
      console.error(JSON.stringify(mergeResp))
      return
    }

    const queryResp = await dynamodb.getEstateId(origId)
    expect(queryResp).toMatchObject({
      estateId: destId.estateId,
      address: "test",
      tileXY: "3726576/1649777",
      zoom: 22,
    })
  })

  test('it fails when the destination does not exist', async () => {
    const origId = "11-0000-0000-0000-0001"
    const destId = "11-0000-0000-0000-0002"

    const mergeResp = await dynamodb.mergeEstateId({
      from: [origId],
      to: destId,
    })

    expect(mergeResp).toMatchObject({
      error: true,
      errorType: "destination_doesnt_exist"
    })
  })

  test('it fails when trying to merge to self', async () => {
    const origId = "11-0000-0000-0000-0003"
    const destId = "11-0000-0000-0000-0003"

    const mergeResp = await dynamodb.mergeEstateId({
      from: [origId],
      to: destId,
    })

    expect(mergeResp).toMatchObject({
      error: true,
      errorType: "destination_is_source"
    })
  })

  test('it fails when destination is not canonical', async () => {
    const destId = await dynamodb.store({
      address: "test",
      tileXY: "3726576/1649777",
      zoom: 22,
      prefCode: "11"
    })

    const origId = "11-0000-0000-0000-0004"
    const origId2 = "11-0000-0000-0000-0005"

    const mergeResp1 = await dynamodb.mergeEstateId({
      from: [origId],
      to: destId.estateId,
    })

    expect(mergeResp1.error).toBe(false)
    if (mergeResp1.error) {
      console.error(JSON.stringify(mergeResp1))
      return
    }

    const mergeResp2 = await dynamodb.mergeEstateId({
      from: [origId2],
      to: origId,
    })

    expect(mergeResp2).toMatchObject({
      error: true,
      errorType: "destination_is_not_canonical"
    })
  })
})

export const _updateServiceUsageQuota = async ( usageKey:string, updateRequestCount:number ) => {

  const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey : usageKey },
    UpdateExpression: 'SET #c = :c',
    ExpressionAttributeNames: {
      '#c': 'c',
    },
    ExpressionAttributeValues: {
      ':c': updateRequestCount
    }
  }
  await dynamodb.DB.update(updateItemInput).promise()
}

export const _getServiceUsageQuotaItem = async ( usageKey:string ) =>{
  const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey : usageKey },
  }
  const { Item: item } = await dynamodb.DB.get(getItemInput).promise()
  return item
}

describe('checkServiceUsageQuota', () => {

  test('it works', async () => {
    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req"
    const res = await dynamodb.checkServiceUsageQuota({ apiKey, quotaType })

    expect(res).toStrictEqual(true)
  })

  test('it fails with QuotaType id-req and requests over 10000', async () => {

    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req"
    const usageKey = dynamodb._generateUsageQuotaKey({ apiKey, quotaType })

    // Add 10000 for requested count
    await _updateServiceUsageQuota(usageKey, 10000)

    const res = await dynamodb.checkServiceUsageQuota({ apiKey, quotaType })

    expect(res).toStrictEqual(false)
  })
})

describe('incrementServiceUsage', () => {
  test('it works', async () => {

    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req";
    const usageKey = dynamodb._generateUsageQuotaKey({ apiKey, quotaType })

    await dynamodb.incrementServiceUsage({ apiKey, quotaType })

    const item = await _getServiceUsageQuotaItem(usageKey)

    // @ts-ignore
    expect(item.c).toStrictEqual(1)
  })
})

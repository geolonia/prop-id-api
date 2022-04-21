import * as dynamodb from './dynamodb'
import { _getServiceUsageQuotaItem, _updateServiceUsageQuota } from './dynamodb_test_helpers.test'
import { DateTime } from "luxon";

describe('mergeEstateId', () => {
  test('it works', async () => {
    const destId = await dynamodb.store({
      rawAddress: "test",
      address: "test",
      rawBuilding: "テストビル",
      building: "テストビル",
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
      rawAddress: "test",
      address: "test",
      rawBuilding: "テストビル",
      building: "テストビル",
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

describe('getEstateIdForAddress', () => {
  test('it returns all IDs with the same normalized address', async () => {
    const address = `getEstateIdForAddress - multiple address`
    const [
      id1,
      id2,
      id3,
    ] = await Promise.all([
      dynamodb.store({
        rawAddress: "東京都千代田区永田町１丁目７−１",
        address,
        tileXY: "3726576/1649777",
        zoom: 22,
        prefCode: "11"
      }),
      dynamodb.store({
        rawAddress: "東京都千代田区永田町１丁目７−１",
        address,
        rawBuilding: "国会議事堂A棟",
        building: "国会議事堂A棟",
        tileXY: "3726576/1649777",
        zoom: 22,
        prefCode: "11"
      }),
      dynamodb.store({
        rawAddress: "東京都千代田区永田町１丁目７−１",
        address,
        rawBuilding: "国会議事堂B棟",
        building: "国会議事堂B棟",
        tileXY: "3726576/1649777",
        zoom: 22,
        prefCode: "11"
      }),
    ])

    const [
      queryResp1,
      queryResp2,
      queryResp3,
    ] = await Promise.all([
      dynamodb.getEstateIdForAddress(address),
      dynamodb.getEstateIdForAddress(address, "国会議事堂A棟"),
      dynamodb.getEstateIdForAddress(address, "国会議事堂B棟"),
    ])

    // All three responses should contain all three IDs
    expect(queryResp1).toContainEqual(id1)
    expect(queryResp1).toContainEqual(id2)
    expect(queryResp1).toContainEqual(id3)

    expect(queryResp2).toContainEqual(id1)
    expect(queryResp2).toContainEqual(id2)
    expect(queryResp2).toContainEqual(id3)

    expect(queryResp3).toContainEqual(id1)
    expect(queryResp3).toContainEqual(id2)
    expect(queryResp3).toContainEqual(id3)
  })
})

describe('checkServiceUsageQuota', () => {

  test('it works', async () => {
    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req"
    const res = await dynamodb.checkServiceUsageQuota({ apiKey, quotaType, customQuotas: {} })

    expect(res.checkResult).toStrictEqual(true)
  })

  test('it fails with QuotaType id-req and requests over 10000', async () => {

    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req"
    const usageKey = dynamodb._generateUsageQuotaKey(apiKey, quotaType)

    // Add 10000 for requested count
    await _updateServiceUsageQuota(usageKey, 10000)

    const res = await dynamodb.checkServiceUsageQuota({ apiKey, quotaType, customQuotas: {} })

    expect(res.checkResult).toStrictEqual(false)
  })

  test('it should return checkResult, quotaLimit, quotaRemaining, quotaResetDate', async () => {

    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req"
    const usageKey = dynamodb._generateUsageQuotaKey(apiKey, quotaType)

    // Add 10000 for requested count
    await _updateServiceUsageQuota(usageKey, 5000)

    const res = await dynamodb.checkServiceUsageQuota({ apiKey, quotaType, customQuotas: {} })

    expect(res.checkResult).toStrictEqual(true)
    expect(res.quotaLimit).toStrictEqual(10000)
    expect(res.quotaRemaining).toStrictEqual(5000)
    expect(res.quotaResetDate).not.toBe(false)
  })
})

describe('incrementServiceUsage', () => {
  test('it works', async () => {

    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req";
    const usageKey = dynamodb._generateUsageQuotaKey(apiKey, quotaType)

    await dynamodb.incrementServiceUsage({ apiKey, quotaType })

    const item = await _getServiceUsageQuotaItem(usageKey)

    // @ts-ignore
    expect(item.c).toStrictEqual(1)
  })
})

describe('getQuotaLimit', () => {
  test('it works', async () => {

    const quotaType = "id-req";
    const customQuotas = {}
    const quotaLimits = dynamodb.getQuotaLimit( quotaType, customQuotas )

    // @ts-ignore
    expect(quotaLimits).toStrictEqual(10000)
  })
  test('it works with customQuotas', () => {

    const quotaType = 'id-req';
    const customQuotas = {
      'id-req' : 500_000
    }
    const quotaLimits = dynamodb.getQuotaLimit( quotaType, customQuotas )

    // @ts-ignore
    expect(quotaLimits).toStrictEqual(500000)
  })

  test('it should return 0 with invalid quotaType', () => {

    const quotaType = "xxx";
    const customQuotas = {}
    const quotaLimits = dynamodb.getQuotaLimit( quotaType, customQuotas )

    // @ts-ignore
    expect(quotaLimits).toStrictEqual(0)
  })

})

describe('getResetQuotaTime', () => {
  test('it works', () => {
    const resetType = 'month'
    const now = DateTime.local(2021, 5, 6, 8, 0).setZone('Asia/Tokyo')
    const actualResetTime = dynamodb.getResetQuotaTime( now, resetType )

    // @ts-ignore
    expect(actualResetTime).toStrictEqual('2021-06-01T00:00:00.000+09:00')
  })
})

test('createdAt and updatedAt params', async () => {
  const now = '2022-01-01T00:00:00.000Z'
  await dynamodb.store({
    rawAddress: "京都市中京区寺町通御池上る上本能寺前町488番地",
    address: "京都市中京区寺町通御池上る上本能寺前町488番地",
    rawBuilding: "テストビル",
    building: "テストビル",
    tileXY: "3726576/1649778",
    zoom: 22,
    prefCode: "11",
  })
  const idObj = await dynamodb.getEstateIdForAddress('京都市中京区寺町通御池上る上本能寺前町488番地')
  expect(typeof idObj[0].createdAt).toEqual('string')
  expect(typeof idObj[0].updatedAt).toEqual('string')
})

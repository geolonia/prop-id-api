import { ManagementClient } from "auth0"
import AWS from "aws-sdk"

const SSM = new AWS.SSM()

export interface PropIdAppMetadata {
  plan?: "paid" | "free"
}

let cachedClient: ManagementClient<PropIdAppMetadata> | undefined = undefined

export const auth0ManagementClient = async (): Promise<ManagementClient<PropIdAppMetadata>> => {
  if (cachedClient) {
    return cachedClient
  }

  const parameterResp = await SSM.getParameter({
    Name: `/propid/auth0/${process.env.AUTH0_CLIENT_ID}`,
    WithDecryption: true
  }).promise()
  const clientSecret = parameterResp.Parameter?.Value

  cachedClient = new ManagementClient<PropIdAppMetadata>({
    domain: 'prop-id.jp.auth0.com',
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret,
    scope: 'read:users'
  })

  return cachedClient
}

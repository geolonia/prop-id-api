import { ManagementClient } from "auth0"
import AWS from "aws-sdk"

const SSM = new AWS.SSM()
export const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "prop-id-dev.jp.auth0.com"

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

  console.log("Creating new Auth0 client", process.env.AUTH0_CLIENT_ID)

  cachedClient = new ManagementClient<PropIdAppMetadata>({
    domain: AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret,
    scope: 'read:users'
  })

  return cachedClient
}

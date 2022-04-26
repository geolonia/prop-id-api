import AWS from 'aws-sdk'

const sqs = new AWS.SQS({ region: 'ap-northeast-1' })

const main = async () => {
  const messages = await sqs.receiveMessage({
    QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/762706324393/prop-id-event-failure-dest-queue-dev',
  }).promise()
  console.log(messages.Messages)
}

main()

import { APIGatewayProxyHandler } from 'aws-lambda';
import axios from 'axios';

const resp = () => ({
  isBase64Encoded: false,
  statusCode: 204,
  body: '',
});

const REQUIRED_REVIEWERS_MIN = 2;

export const handler: APIGatewayProxyHandler = async (event) => {
  const encodedPayload = event.body;

  if (!encodedPayload) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'unauthorized' }),
    };
  }

  const payload = JSON.parse(encodedPayload);

  const action = payload.actions[0];
  if (!action) {
    return resp();
  }

  if (action.action_id === 'approveAddress') {
    // Approve の処理
    // Logs テーブルを使って承認したユーザーをカウントする。
    // レビュー数が満たない場合はレビュアーの表示だけ更新して終了
    // レビューがみちたら addressPending -> addressReviewed に変更する
  } else if (action.action_id === 'rejectAddress') {
    // rejected のステータスに更新する
  }

  return resp();
};



// axios.post(payload.response_url, {
//   replace_original: true,
//   text: 'Deploy cancelled.',
//   'blocks': [
//     {
//       'type': 'section',
//       'text': {
//         'type': 'mrkdwn',
//         'text': `Deploy cancelled by <@${payload.user.id}>`,
//       },
//     },
//   ],
// });

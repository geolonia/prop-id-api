
import { sendSlackNotification } from './lib/slack';
import type { PlainTextElement, MrkdwnElement } from '@slack/types';

export const ipcNormalizationErrorReport = async (identifier: string, metadata: { [key: string]: any }) => {

  const { prenormalized, geocoding_level } = metadata;

  if (process.env.STAGE !== 'v1') return;

  let title = '';
  const fields: (PlainTextElement | MrkdwnElement)[] = [];

  if (identifier === 'normFailNoIPCGeomNull') {
    title =  'API のレスポンスが null でした';

  } else if (identifier === 'normFailNoIPCGeom') {
    title = '住所を確認できませんでした';

  } else if (identifier === 'normLogsIPCGeom') {
    title = 'Geocoding レベル4(丁目/小字)以下の住所を検出しました';
    fields.push({
      type: 'mrkdwn',
      text: `*Geocodingレベル*\n${geocoding_level}`,
    });
  }

  fields.push({
    type: 'mrkdwn',
    text: `*入力住所*\n${prenormalized}`,
  });

  try {
    await sendSlackNotification({
      channel: 'dev-ipc-normalize-errors-notifications',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${title}*`,
          },
        },
        {
          type: 'section',
          fields,
        },
      ],
    });
  } catch (e: any) {
    console.log('Slack notification failed with error: ', e);
  }
};

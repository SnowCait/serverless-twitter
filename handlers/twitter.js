'use strict';

// TODO: Replace to https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/retrieving-secrets_lambda.html
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const secretsManager = new SecretsManagerClient({ region: 'ap-northeast-1' });

module.exports.auth = async event => {
  return new Promise(async (resolve, reject) => {
    const { code, verifier, redirectUrl } = JSON.parse(event.body);

    const command = new GetSecretValueCommand({ SecretId: 'TwitterClientSecret' });
    const secrets = await secretsManager.send(command);
    console.log('[secrets]', secrets);

    const url = 'https://api.twitter.com/2/oauth2/token';
    const clientId = 'NnduMzZ5bnk4T1RfT21BdkJlZUg6MTpjaQ';
    const { TWITTER_CLIENT_SECRET: clientSecret } = JSON.parse(secrets.SecretString);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUrl,
        code_verifier: verifier,
      }),
    });

    const data = await response.text();
    console.log('[data]', data);
    resolve({
      statusCode: 200,
      body: data,
    });
  });
};

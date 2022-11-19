'use strict';

// TODO: Replace to https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/retrieving-secrets_lambda.html
const region = 'ap-northeast-1';
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const secretsManager = new SecretsManagerClient({ region });
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const db = new DynamoDBClient({ region });

module.exports.auth = async event => {
  const { code, verifier, redirectUrl } = JSON.parse(event.body);

  const getSecretValueCommand = new GetSecretValueCommand({ SecretId: 'TwitterClientSecret' });
  const secrets = await secretsManager.send(getSecretValueCommand);

  // Access Token
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

  const token = await response.json();
  const { access_token: accessToken } = token;

  // Me
  const meResponse = await fetch('https://api.twitter.com/2/users/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const { data: me } = await meResponse.json();
  console.log('[me]', me);

  // Save
  const putItemCommand = new PutItemCommand({
    TableName: process.env.users_table,
    Item: {
      userId: me.id,
      accessToken,
    },
  });
  await db.send(putItemCommand);

  return {
    statusCode: 200,
    body: JSON.stringify({ ...token, ...me }),
  };
};

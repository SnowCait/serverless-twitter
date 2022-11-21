'use strict';

// AWS SDK
// TODO: Replace to https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/retrieving-secrets_lambda.html
const region = 'ap-northeast-1';
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const secretsManager = new SecretsManagerClient({ region });
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDB = new DynamoDBClient({ region });
const db = DynamoDBDocumentClient.from(dynamoDB);

// Twitter
const clientId = 'NnduMzZ5bnk4T1RfT21BdkJlZUg6MTpjaQ';

module.exports.authorizer = async event => {
  console.log('[event]', event);

  const [ userId, accessToken ] = event.headers.authorization.split(':');

  const { Item: user } = await db.send(new GetCommand({
    TableName: process.env.users_table,
    Key: {
      twitterUserId: userId,
    },
  }));
  console.log('[user]', user);

  return {
    isAuthorized: accessToken === user?.accessToken,
    context: {
      userId,
      accessToken,
    },
  }
};

module.exports.auth = async event => {
  console.log('[event]', event);

  const { code, verifier, redirectUrl } = JSON.parse(event.body);

  // Client Secret
  const getSecretValueCommand = new GetSecretValueCommand({ SecretId: 'TwitterClientSecret' });
  const secrets = await secretsManager.send(getSecretValueCommand);
  const { TWITTER_CLIENT_SECRET: clientSecret } = JSON.parse(secrets.SecretString);

  // Access Token
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
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
  const { access_token: accessToken, refresh_token: refreshToken } = token;

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
  await db.send(new PutCommand({
    TableName: process.env.users_table,
    Item: {
      twitterUserId: me.id,
      accessToken,
      refreshToken,
    },
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ ...token, ...me }),
  };
};

module.exports.refresh = async event => {
  console.log('[event]', event);

  const { userId } = event.requestContext.authorizer.lambda;

  // User
  const { Item: user } = await db.send(new GetCommand({
    TableName: process.env.users_table,
    Key: {
      twitterUserId: userId,
    },
  }));
  console.log('[user]', user);

  // Client Secret
  const getSecretValueCommand = new GetSecretValueCommand({ SecretId: 'TwitterClientSecret' });
  const secrets = await secretsManager.send(getSecretValueCommand);
  const { TWITTER_CLIENT_SECRET: clientSecret } = JSON.parse(secrets.SecretString);

  // Access Token
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
    }),
  });

  const json = await response.text();
  console.log('[token]', json);

  const { access_token: accessToken, refresh_token: refreshToken } = JSON.parse(json);

  // Save
  await db.send(new PutCommand({
    TableName: process.env.users_table,
    Item: {
      twitterUserId: userId,
      accessToken,
      refreshToken,
    },
  }));

  return {
    statusCode: 200,
    body: json,
  };
};

module.exports.tweet = async event => {
  console.log('[event]', event);

  const { userId } = event.requestContext.authorizer.lambda;
  const { text } = JSON.parse(event.body);

  // Save
  await db.send(new PutCommand({
    TableName: process.env.tweets_table,
    Item: {
      twitterUserId: userId,
      createdAt: Date.now(),
      text,
    },
  }));

  // // Save to Twitter
  // const response = await fetch('https://api.twitter.com/2/tweets', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${accessToken}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     text,
  //   }),
  // });

  // const json = await response.text();

  // if (!response.ok) {
  //   console.log('[tweet failed]', json);
  //   return {
  //     statusCode: 400,
  //     body: json,
  //   };
  // }

  return {
    statusCode: 200,
    // body: json,
  };
};

module.exports.timeline = async event => {
  console.log('[event]', event);

  const { userId } = event.requestContext.authorizer.lambda;

  // Save
  const { Items: timeline, Count: count, ScannedCount: scannedCount } = await db.send(new QueryCommand({
    TableName: process.env.tweets_table,
    KeyConditionExpression: 'twitterUserId = :twitterUserId',
    ExpressionAttributeValues: {
      ':twitterUserId': userId,
    },
    ScanIndexForward: false,
    Limit: 5,
  }));
  console.log('[timeline]', timeline, count, scannedCount);

  return {
    statusCode: 200,
    body: JSON.stringify(timeline),
  };
};

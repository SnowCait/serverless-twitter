'use strict';

const https = require('https');
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({
  region: 'ap-northeast-1',
});

module.exports.hello = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v3.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  };
};

module.exports.auth = async (event, context, callback) => {
  const { code, verifier } = JSON.parse(event.body);

  const secret_name = "TwitterClientSecret";
  const response = await secretsManager.getSecretValue({
    SecretId: secret_name,
  }).promise();

  const url = 'https://api.twitter.com/2/oauth2/token';
  const clientId = 'NnduMzZ5bnk4T1RfT21BdkJlZUg6MTpjaQ';
  const clientSecret = response.SecretString;
  const redirectUrl = 'http://localhost/';
  const request = await https.request(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/json',
    },
  }, response => {
    console.log('[access token]', response);
    response.setEncoding('utf8');
    response.on('data', chunk => {
      callback(chunk, response.statusCode);
    });
  }).on('error', error => {
    callback(Error(error));
  });

  request.write(JSON.stringify({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUrl,
    code_verifier: verifier,
  }));

  request.end();
};

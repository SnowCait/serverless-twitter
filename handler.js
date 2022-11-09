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

module.exports.auth = async event => {
  return new Promise(async (resolve, reject) => {
    const { code, verifier } = JSON.parse(event.body);

    const secret_name = "TwitterClientSecret";
    const response = await secretsManager.getSecretValue({
      SecretId: secret_name,
    }).promise();

    const url = 'https://api.twitter.com/2/oauth2/token';
    const clientId = 'NnduMzZ5bnk4T1RfT21BdkJlZUg6MTpjaQ';
    const { TWITTER_CLIENT_SECRET: clientSecret } = JSON.parse(response.SecretString);
    const redirectUrl = 'http://localhost/';
    const request = await https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    }, response => {
      response.setEncoding('utf8');
      response.on('data', data => {
        console.log('[data]', data);
        resolve({
          statusCode: 200,
          body: data,
        });
      });
      response.on('end', () => {
        console.log('[end]');
      });
    }).on('error', error => {
      console.log('[error]', error);
      reject(Error(error));
    });

    request.write(JSON.stringify({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUrl,
      code_verifier: verifier,
    }));

    request.end();
  });
};

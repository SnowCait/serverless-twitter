'use strict';

module.exports.hello = async (event) => {
  console.log(event);
  console.log(process);
  console.log(process.moduleLoadList);
  const response = await fetch('https://snowcait.github.io/serverless-twitter/');
  console.log(await response.text());
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

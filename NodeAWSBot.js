require('es6-promise').polyfill();
require('isomorphic-fetch');
const {v4: uuidv4} = require('uuid');
const {SecretsManagerClient, GetSecretValueCommand} = require("@aws-sdk/client-secrets-manager");
const {AWSAppSyncClient} = require('aws-appsync');
const gql = require('graphql-tag');
const {createMessage} = require('./graphql.js');
const { Configuration, OpenAIApi } = require("openai");
const {encode} = require('./mod');

async function updateAppSync(appSyncKey, text, chatId, botId) {
  const client = new AWSAppSyncClient({
    url: 'https://INSERTURL.appsync-api.us-west-2.amazonaws.com/graphql',
    region: 'us-west-2',
    auth: {
      type: 'API_KEY',
      apiKey: 'INSERT-KEY',
    },
    disableOffline: true,
  });
  await client.mutate({
    mutation: gql(createMessage),
    variables: {
      input: {
        id: uuidv4(),
        type: 'Message',
        chatId: chatId,
        botId: botId,
        content: text,
        createdAt: new Date(Date.now()).toISOString(),
      },
    },
  });
  return {
    statusCode: 200,
    body: text,
  };
}

function sliceIntoChunks(arr, chunkSize) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}

function getTokenCount(string) {
  let tokenCount = 0;
  let encoded = encode(string);
  for (let token of encoded) {
    tokenCount++;
  }
  return tokenCount;
}

// ${params.bot.name} is a talkative, flirtatious woman who lives in Japan

exports.handler = async (event, context, callback) => {
  let secretClient = new SecretsManagerClient({region: "us-west-2"});
  let response = await secretClient.send(new GetSecretValueCommand({ SecretId: "Chatbot", VersionStage: "AWSCURRENT"}));
  let secret = JSON.parse(response.SecretString);

  let configuration = new Configuration({apiKey: secret.OpenAIKey});
  let openai = new OpenAIApi(configuration);

  let params = event;
  let max_allowed_tokens = 2048;
  let max_generated_tokens = 100;
  let background = `This is a conversation between ${params.user.name} and ${params.bot.name}.\n\n`;
  let prompt = background;
  let userFirstName = params.user.name.split(' ')[0];
  let botFirstName = params.bot.name.split(' ')[0];
  let newInput = `${userFirstName}: ${params.content}\n${botFirstName}:`;
  let stopString = `${userFirstName}:`;
  let previous_messages_chunks = sliceIntoChunks(params.lastMessages, 2).reverse();
  if (params.lastMessages.length === 8) {
    max_allowed_tokens =
        max_allowed_tokens -
        max_generated_tokens -
        getTokenCount(prompt + newInput);
    for (let chunk of previous_messages_chunks) {
      let pair = `${userFirstName}: ${chunk[1].content}\n${botFirstName}: ${chunk[0].content}\n`;
      let tokenCount = getTokenCount(pair);
      if (max_allowed_tokens - tokenCount >= 0) {
        newInput = pair + newInput;
        max_allowed_tokens = max_allowed_tokens - tokenCount;
      } else {
        break;
      }
    }
  } else {
    let messagesArray = params.lastMessages.map(message => {
      let name = message.userId ? userFirstName : botFirstName;
      return `${name}: ${message.content}\n`;
    });
    newInput = messagesArray.join('') + newInput;
  }
  prompt = prompt + newInput;
  await openai
      .createCompletion({
        model: 'text-davinci-003',
        prompt: prompt,
        max_tokens: max_generated_tokens,
        temperature: 0,
        stop: stopString,
      })
      .then(async function (response) {
        await updateAppSync(
            secret.AWSKey,
            response.data.choices[0].text.trim(),
            params.chatId,
            params.bot.id,
        );
      })
      .catch(async function (err) {
        // This is a fallback just in case OpenAI flags the input or output
        console.log(err);
        const NLPCloudClient = require('nlpcloud');
        const nlp = new NLPCloudClient(
            'finetuned-gpt-neox-20b',
            secret.NLPCloudKey,
            true,
        );
        let messagesArray = previous_messages_chunks.map(chunk => {
          return {input: chunk[1].content, response: chunk[0].content};
        });
        await nlp
            .chatbot(params.content, background, messagesArray)
            .then(async function (response) {
              await updateAppSync(
                  secret.AWSKey,
                  response.data.response,
                  params.chatId,
                  params.bot.id,
              ).catch(async function (error) {
                console.log(error);
              });
            });
      });
};

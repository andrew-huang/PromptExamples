import json
import time
import cohere
import uuid
from urllib.parse import urlparse
from gql import Client, gql
from gql.transport.aiohttp import AIOHTTPTransport
from gql.transport.appsync_auth import AppSyncApiKeyAuthentication

def handler(event, context):
    print(event)
    params = json.loads(event["body"])
    print(params)
    background = f'This is a conversation between {params["user"]["name"]} and {params["bot"]["name"]}.\n\n'
    prompt = background
    userFirstName = params['user']['name'].split(' ')[0]
    botFirstName = params['bot']['name'].split(' ')[0]
    newInput = f'{userFirstName}: {params["content"]}\n{botFirstName}:'
    stopString = f'{userFirstName}:'
    messagesArray = []
    for message in params['lastMessages']:
        if message['userId']:
            name = userFirstName
        else:
            name = botFirstName
        messagesArray.append(f'{name}: {message["content"]}\n')

    newInput = ''.join(messagesArray) + newInput
    prompt = prompt + newInput
    co = cohere.Client('INSERT-KEY')
    response = co.generate(
        prompt=prompt,
        model='command-xlarge-nightly-2',
        max_tokens=100,
        temperature=0,
        stop_sequences=[stopString],
    )
    content = response.generations[0].text.replace(stopString, "").strip()
    url = 'https://INSERTURL.appsync-api.us-west-2.amazonaws.com/graphql'
    api_key = 'INSERT-KEY'

    host = str(urlparse(url).netloc)
    auth = AppSyncApiKeyAuthentication(host=host, api_key=api_key)
    transport = AIOHTTPTransport(url=url, auth=auth)
    client = Client(transport=transport,fetch_schema_from_transport=False)

    mutation = gql("""
      mutation CreateMessage(
        $input: CreateMessageInput!
        $condition: ModelMessageConditionInput
      ) {
        createMessage(input: $input, condition: $condition) {
          id
          content
          createdAt
          type
          chatId
          userId
          botId
          updatedAt
          owner
        }
      }
      """)

    variables = {'input': {'id': str(uuid.uuid4()),
                           'type': 'Message',
                           'chatId': params['chatId'],
                           'botId': params['bot']['id'],
                           'content': content,
                           'createdAt': int(time.time())}}

    client.execute(mutation, variable_values=json.dumps(variables))
    return {
        'statusCode': 200,
        'body': 'Done'
    }

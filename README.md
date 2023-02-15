## Prompt Examples

## 1. DoctorBot.ipynb

Easily turn AI21 Labs' J-1 Grande Instruct model into a medical chatbot using a web scraper, VectorDB, and conversational memory.
1. Scrape all of WebMD using DoctorBotScraper.ipynb and write it all into a single text file.
2. Chunk the text file and upload it to a vector database hosted on Pinecone.
3. Ask a question and auto insert the most relevant docs in your VectorDB into a chat prompt using Langchain.
4. Generate a completion with the AI21 Labs API.
5. Ask followup questions with prior conversation history automatically included.

Also submitted a [pull request](https://github.com/hwchase17/langchain/pull/1069) to Langchain to better support stop sequences with AI21.

## 2. DoctorBotScraper.ipynb

Web scraper that scrapes all of WebMD.

- Nothing too fancy, had to write different functions to support scraping basic content, slideshows, and resource hub directories.
- Uses a library called cloudscraper which auto gets around Cloudflare captchas to avoid rate limiting when mass scraping.
- Saves the scraped urls to DynamoDB.

## 3. NapoleonBot.ipynb

Ask Napoleon a question using data from the Wikipedia API (but works for any subject)
1. Query the Wikipedia API to fetch the content from an article.
2. Create a tree index using GPTIndex.
3. Ask a question and auto insert the most relevant context chunk into a chat prompt. Set the prompt to answer "factually", "in the first person", and to not use prior knowledge. 
4. Generate a completion using OpenAI.

## 4. NodeAWSBot.ipynb

Have a conversation with a bot using an AWS Lambda endpoint and save the response to DynamoDB using a GraphQL mutation.

1. When the Lambda is called, use the data in the params on the bot, user, and prior messages, to construct a chat prompt.
2. Calculate the tokens used in the prompt with tiktoken and if it's over the limit for the model, don't include the oldest messages.
3. Generate a completion with OpenAI / Cohere, with a fallback to use NLPCloud if the response is blocked for bad language, etc...
4. Save the bot's response to DynamoDB using a GraphQL mutation via AWS AppSync.
5. On the frontend I have a GraphQL subscription that auto fetches the bot's response in realtime.

## 5. PythonAWSBot.ipynb

Same thing as above but instead of being written in Nodejs, I wrote it in Python.

Also have a lot of smaller prompts and projects for generating and summarizing text content, as well as image content with Stable Diffusion, but that are not included in this repo.

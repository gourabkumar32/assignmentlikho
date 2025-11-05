# Assignment Submission System

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up MongoDB:

Either:
- Use MongoDB Atlas (recommended for production)
  - Create a cluster at https://cloud.mongodb.com
  - Add your IP to the whitelist
  - Copy the connection string to .env file

Or:
- Use Local MongoDB (recommended for development)
  - Install MongoDB Community Server
  - Create a data directory:
    ```bash
    mkdir data
    ```
  - Start MongoDB:
    ```bash
    mongod --dbpath=./data
    ```

3. Start the application:
```bash
node server.js
```
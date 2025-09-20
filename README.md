# Friend Rotator

A simple SMS app that helps you stay in touch with friends.  
Built with **Node.js**, **Express**, **Postgres**, **Twilio**, and **Docker**.

## Setup

### Requirements
- Docker + Docker Compose
- Node.js
- ngrok (for exposing local server to Twilio)
- A Twilio account with an SMS-enabled phone number

### Local Development
1. Copy `.env.example` → `.env` and fill in your secrets.
2. Start the app + database:
   ```bash
   docker-compose up --build
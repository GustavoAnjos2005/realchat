# RealChat

Full-stack real-time chat application with AI assistant, built using Node.js, React, TypeScript, Tailwind CSS, Prisma (PostgreSQL), and Redis. Features user authentication, online status, message history, typing indicators, and a modern responsive interface. Includes an AI assistant for automatic replies.

---

## Project Summary

RealChat is a real-time chat platform where users can communicate instantly, see who is online, and interact with an AI assistant for smart replies. The project features a modern UI, secure authentication, and scalable backend, making it ideal for learning or as a foundation for more advanced chat solutions.

---

## Stack

- Node.js
- Express
- TypeScript
- React
- Vite
- Tailwind CSS
- Socket.IO
- Prisma (PostgreSQL)
- Redis
- JWT Authentication

---

## Features

- User authentication (login/register)
- Real-time chat between users
- Online user indicator
- Message history
- AI assistant for automatic replies
- Typing indicator
- Responsive and modern interface

---

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/GustavoAnjos2005/realchat.git
   cd realchat
   ```
2. **Install dependencies**
   ```bash
   # Backend
   npm install

   # Frontend
   cd frontend
   npm install
   ```
3. **Configure environment variables**
   - Copy `.env.example` to `.env` and fill in your values
4. **Setup the database**
   ```bash
   npx prisma migrate dev
   ```
5. **Start the services**
   ```bash
   # Backend
   npm run dev

   # Frontend (in another terminal)
   cd frontend
   npm run dev
   ```

---

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `REDIS_URL`: Redis connection string
- `PORT`: Server port (default: 3000)
- `HUGGINGFACE_TOKEN`: Hugging Face API token (optional)

---

![chat1](https://github.com/user-attachments/assets/11fdb099-edc5-4e23-a3d3-c0b191e977d9)
![chat2](https://github.com/user-attachments/assets/82aa9658-0aee-4c9e-9dce-2dd17a9aa412)
![chat3](https://github.com/user-attachments/assets/5e91cef7-6570-4e44-85f0-1c26340723cd)
![chat4](https://github.com/user-attachments/assets/5a1b0eb6-857c-4a83-ae22-2cf71febadc7)

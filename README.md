# Chat em Tempo Real com IA

Uma aplicação de chat em tempo real com suporte a conversas entre usuários e um assistente de IA.

## Tecnologias Utilizadas

### Backend
- Node.js
- TypeScript
- Express
- Socket.IO
- Prisma (PostgreSQL)
- Redis
- JWT para autenticação

### Frontend
- React
- TypeScript
- Vite
- TailwindCSS
- Socket.IO Client

## Funcionalidades

- Autenticação de usuários (login/registro)
- Chat em tempo real entre usuários
- Indicador de usuários online
- Histórico de mensagens
- Assistente de IA para respostas automáticas
- Indicador de digitação
- Interface responsiva e moderna

## Configuração

1. Clone o repositório
```bash
git clone https://github.com/GustavoAnjos2005/realchat.git
cd realchat
```

2. Instale as dependências (backend e frontend)
```bash
# Backend
npm install

# Frontend
cd frontend
npm install
```

3. Configure as variáveis de ambiente
- Copie o arquivo `.env.example` para `.env`
- Preencha as variáveis com seus valores

4. Configure o banco de dados
```bash
npx prisma migrate dev
```

5. Inicie os serviços
```bash
# Backend
npm run dev

# Frontend (em outro terminal)
cd frontend
npm run dev
```

## Variáveis de Ambiente

O projeto requer as seguintes variáveis de ambiente:

- `DATABASE_URL`: URL de conexão com o PostgreSQL
- `JWT_SECRET`: Chave secreta para geração de tokens JWT
- `REDIS_URL`: URL de conexão com o Redis
- `PORT`: Porta do servidor (padrão: 3000)
- `HUGGINGFACE_TOKEN`: Token da API do Hugging Face (opcional)
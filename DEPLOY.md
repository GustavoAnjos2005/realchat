# 🚀 Deploy no Vercel - Chat GPT Realtime

Este guia te ajudará a fazer o deploy do seu projeto no Vercel.

## 📋 Pré-requisitos

1. **Conta no GitHub** - com o projeto já commitado
2. **Conta no Vercel** - criar em [vercel.com](https://vercel.com)
3. **Banco de dados PostgreSQL** - recomendo [Neon](https://neon.tech) ou [Supabase](https://supabase.com)
4. **Chaves de API necessárias**

## 🔧 Configuração das Variáveis de Ambiente

Antes do deploy, você precisa configurar as seguintes variáveis de ambiente no Vercel:

### Obrigatórias:
- `DATABASE_URL`: URL do PostgreSQL (ex: postgresql://user:pass@host:5432/db)
- `JWT_SECRET`: Uma string aleatória forte para tokens JWT
- `NODE_ENV`: production

### Opcionais (para funcionalidades específicas):
- `OPENAI_API_KEY`: Para integração com ChatGPT
- `HUGGINGFACE_TOKEN`: Para modelos do Hugging Face
- `REDIS_URL`: Para cache (se usar Redis)

## 🚀 Passos para Deploy

### 1. Preparar o Repositório
Certifique-se de que todos os arquivos estão commitados no GitHub:
```bash
git add .
git commit -m "Preparando para deploy no Vercel"
git push origin main
```

### 2. Conectar ao Vercel
1. Acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub
3. Clique em "New Project"
4. Selecione seu repositório `chat-gpt-realtime`

### 3. Configurar o Deploy
No painel do Vercel:

**Build & Development Settings:**
- Framework Preset: `Other`
- Build Command: `npm run vercel-build`
- Output Directory: `frontend/dist`
- Install Command: `npm install`

**Root Directory:**
- Deixe em branco (raiz do projeto)

### 4. Configurar Variáveis de Ambiente
Na aba "Environment Variables" do Vercel, adicione:

```
DATABASE_URL=postgresql://seu_usuario:sua_senha@seu_host:5432/seu_banco
JWT_SECRET=sua_chave_jwt_super_secreta_aqui
NODE_ENV=production
OPENAI_API_KEY=sua_chave_openai_aqui
```

### 5. Fazer o Deploy
1. Clique em "Deploy"
2. Aguarde o build completar
3. Acesse a URL fornecida pelo Vercel

## 🗄️ Configuração do Banco de Dados

### Opção 1: Neon (Recomendado)
1. Acesse [neon.tech](https://neon.tech)
2. Crie uma conta gratuita
3. Crie um novo projeto
4. Copie a connection string
5. Cole como `DATABASE_URL` no Vercel

### Opção 2: Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie um projeto
3. Vá em Settings > Database
4. Copie a connection string
5. Cole como `DATABASE_URL` no Vercel

### Migração do Banco
Após configurar o banco, você precisa rodar as migrações. No terminal local:

```bash
# Instalar Prisma CLI globalmente (se não tiver)
npm install -g prisma

# Configurar a DATABASE_URL no seu .env local
echo "DATABASE_URL=sua_url_do_banco_aqui" > .env

# Rodar as migrações
npx prisma migrate deploy

# (Opcional) Visualizar o banco
npx prisma studio
```

## 🔐 Gerando JWT_SECRET

Para gerar uma chave JWT segura, use um destes métodos:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64

# Online (use apenas para desenvolvimento)
# https://generate-secret.vercel.app/64
```

## 🌐 Domínio Personalizado (Opcional)

1. No painel do Vercel, vá para "Domains"
2. Adicione seu domínio personalizado
3. Configure os DNS conforme instruído
4. Atualize as variáveis `FRONTEND_URL` se necessário

## 🐛 Troubleshooting

### Erro de Build
- Verifique se todas as dependências estão no `package.json`
- Confirme que o comando de build está correto
- Veja os logs de build no Vercel

### Erro de Banco de Dados
- Confirme se a `DATABASE_URL` está correta
- Verifique se as migrações foram executadas
- Teste a conexão localmente primeiro

### Erro de CORS
- As configurações de CORS já estão ajustadas para produção
- Se necessário, adicione sua URL customizada nas configurações

### WebRTC não funciona
- Verifique se o HTTPS está ativo (obrigatório para WebRTC)
- Confirme se as permissões de câmera/microfone estão sendo solicitadas

## 📚 Comandos Úteis

```bash
# Testar build localmente
npm run build

# Ver logs do Vercel
npx vercel logs

# Fazer redeploy
git commit --allow-empty -m "Redeploy"
git push

# Verificar status do deploy
npx vercel ls
```

## 🎯 Checklist Pós-Deploy

- [ ] Aplicação carrega sem erros
- [ ] Login/registro funcionam
- [ ] Chat em tempo real funciona
- [ ] Upload de arquivos funciona
- [ ] Chamadas de vídeo/áudio funcionam
- [ ] Responsividade em mobile funciona
- [ ] SSL/HTTPS está ativo

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no painel do Vercel
2. Teste localmente primeiro
3. Confirme todas as variáveis de ambiente
4. Verifique se o banco está configurado corretamente

---

**🎉 Parabéns! Seu chat está no ar!** 🚀
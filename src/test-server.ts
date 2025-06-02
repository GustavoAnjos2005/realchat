import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

console.log('=== TESTE BÁSICO ===');
console.log('REDIS_URL:', process.env.REDIS_URL?.substring(0, 30) + '...');

app.use(cors());
app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: 'Servidor funcionando!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});

export default app;
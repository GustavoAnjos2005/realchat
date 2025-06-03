// Logger adaptado para ambientes serverless (Vercel)
// Em produção/Vercel, use apenas console.log/error

const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

const logger = {
  info: (...args: any[]) => {
    if (isVercel) {
      console.log('[INFO]', ...args);
    } else {
      // Salva logs de info em combined.log
      winston.log('info', ...args);
    }
  },
  error: (...args: any[]) => {
    if (isVercel) {
      console.error('[ERROR]', ...args);
    } else {
      // Salva logs de erro em error.log
      winston.log('error', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isVercel) {
      console.warn('[WARN]', ...args);
    } else {
      // Salva logs de aviso em combined.log
      winston.log('warn', ...args);
    }
  }
};

export default logger;
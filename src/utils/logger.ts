import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Garante que a pasta logs existe
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // Salva logs de erro em error.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error' 
        }),
        // Salva todos os logs em combined.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log')
        }),
        // Mostra logs no console também
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

export default logger;
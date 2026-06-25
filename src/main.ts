import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis-io.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Si REDIS_URL está definida (entorno de varias réplicas), usa el adaptador
  // de Redis para que los mensajes se difundan entre TODOS los pods.
  // Sin REDIS_URL (desarrollo local), funciona en memoria con una sola instancia.
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisAdapter = new RedisIoAdapter(app);
    try {
      await redisAdapter.connectToRedis(redisUrl);
      app.useWebSocketAdapter(redisAdapter);
    } catch (err) {
      // No tumbar el pod si Redis no está disponible: degrada a modo en memoria.
      logger.error(
        `No se pudo conectar a Redis (${redisUrl}): ${err}. ` +
          'Se continúa en modo en memoria (broadcast solo dentro de este pod).',
      );
    }
  } else {
    logger.log('REDIS_URL no definida: modo en memoria (instancia única).');
  }

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Servidor escuchando en el puerto ${process.env.PORT ?? 3000}`);
}
bootstrap();

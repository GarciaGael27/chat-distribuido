import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions, Server } from 'socket.io';

/**
 * Adaptador de Socket.io respaldado por Redis.
 *
 * Con varias réplicas (pods) detrás del Service, cada instancia de Socket.io
 * mantiene sus clientes en memoria. El adaptador de Redis usa Pub/Sub para
 * propagar los `server.emit()` entre TODAS las instancias, de modo que un
 * mensaje publicado en el Pod #1 llega también a los clientes del Pod #2.
 *
 * Es lo que convierte el chat en realmente distribuido y de alta disponibilidad.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  /**
   * Conecta a Redis y prepara el constructor del adaptador.
   * Devuelve `true` si la conexión tuvo éxito.
   */
  async connectToRedis(url: string): Promise<boolean> {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => this.logger.error(`Redis (pub): ${err}`));
    subClient.on('error', (err) => this.logger.error(`Redis (sub): ${err}`));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(`Adaptador Redis conectado a ${url}`);
    return true;
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.adapterConstructor);
    return server;
  }
}

import {  
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';

  // transports: ['websocket'] fuerza una única conexión TCP por cliente.
  // Esto evita el problema de "Session ID unknown" cuando hay varias réplicas
  // detrás del Service (el long-polling repartiría las peticiones entre pods).
  @WebSocketGateway({ cors: { origin: '*' }, transports: ['websocket'] })
  export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {

    @WebSocketServer()
    server: Server;

    private usuarios: Map<string, string> = new Map();

    handleConnection(client: Socket) {
      console.log(`Cliente conectado: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
      const nombre = this.usuarios.get(client.id) || 'Anónimo';
      this.usuarios.delete(client.id);
      this.server.emit('mensaje', {
        usuario: 'Sistema',
        texto: `${nombre} salió del chat`,
        hora: new Date().toISOString(),
      });   
      console.log(`Cliente desconectado: ${client.id}`);
    }
  
    @SubscribeMessage('unirse')
    handleUnirse(
      @MessageBody() nombre: string,
      @ConnectedSocket() client: Socket,
    ) {
      this.usuarios.set(client.id, nombre);
      this.server.emit('mensaje', {
        usuario: 'Sistema',
        texto: `${nombre} se unió al chat`,
        hora: new Date().toISOString(),
      });   
    }

    @SubscribeMessage('mensaje')
    handleMensaje(
      @MessageBody() texto: string,
      @ConnectedSocket() client: Socket,
    ) {
      const nombre = this.usuarios.get(client.id) || 'Anónimo';
      this.server.emit('mensaje', {
        usuario: nombre,
        texto,
        hora: new Date().toISOString(),
      });
    }
  }

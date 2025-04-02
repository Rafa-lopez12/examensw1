import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { DiagramWsService } from './diagram-ws.service';
import { Server, Socket } from 'socket.io';

@WebSocketGateway()
export class DiagramWsGateway implements OnGatewayConnection, OnGatewayDisconnect{
  
  @WebSocketServer() 
  wss:Server

  constructor(private readonly diagramWsService: DiagramWsService) {}

  handleConnection(client: Socket) {
    console.log('cliente conectado', client.id)
  }
  handleDisconnect(client: Socket) {
    console.log('cliente desconectado', client.id)
  }
}


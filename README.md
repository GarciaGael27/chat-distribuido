# Chat Distribuido en Tiempo Real con WebSockets

Proyecto ordinario de **Sistemas Distribuidos y Alta Disponibilidad**.

Chat en tiempo real con arquitectura distribuida de alta disponibilidad:
servidor **NestJS + Socket.io**, cliente web estático servido por el propio
servidor, contenedorizado con **Podman** y orquestado con **MicroShift**
(Kubernetes) usando **2 réplicas** para tolerancia a fallos.

> 📄 La documentación técnica completa (diseño, protocolo, infraestructura,
> tolerancia a fallos y diagramas) está en [`docs/documentacion.tex`](docs/documentacion.tex)
> y su PDF compilado en [`docs/documentacion.pdf`](docs/documentacion.pdf).
>
> 🛠️ Guía de instalación y despliegue paso a paso: [`INSTALACION.md`](INSTALACION.md).

## Estructura del proyecto

```
chat-distribuido/
├── src/
│   ├── main.ts                  Punto de entrada (puerto 3000)
│   ├── app.module.ts            Módulo raíz: ChatModule + ServeStatic
│   └── chat/
│       ├── chat.gateway.ts      Lógica WebSocket: conexiones y broadcast
│       └── chat.module.ts       Providers del módulo chat
├── public/
│   ├── index.html               Interfaz (pantalla de login y de chat)
│   ├── style.css                Estilos
│   └── client.js                Cliente Socket.io: eventos y DOM
├── k8s/
│   ├── deployment.yaml          2 réplicas + liveness/readiness probes
│   └── service.yaml             Exposición vía NodePort
├── docs/
│   ├── documentacion.tex        Documentación técnica (LaTeX)
│   └── documentacion.pdf        Documentación compilada
└── Dockerfile                   Imagen de contenedor (node:20-alpine)
```

## Desarrollo local

```bash
npm install
npm run start:dev          # http://localhost:3000
```

## Despliegue en MicroShift

```bash
# 1. Construir la imagen con Podman (en la VM Red Hat)
podman build -t chat-distribuido:latest .

# 2. Desplegar
oc apply -f k8s/deployment.yaml
oc apply -f k8s/service.yaml

# 3. Obtener el puerto y abrir el chat
oc get service chat-service          # http://IP_VM:NODEPORT
```

## Prueba de tolerancia a fallos (chaos test)

```bash
oc get pods                          # 2 pods Running
oc delete pod <uno-de-los-pods>      # se elimina una réplica
oc get pods                          # MicroShift crea un pod nuevo
# Los clientes muestran "Reconectando..." y vuelven a "Conectado" solos.
```

## Compilar la documentación

```bash
cd docs
latexmk -pdf documentacion.tex       # genera documentacion.pdf
```

## Eventos del protocolo (Socket.io)

| Evento     | Dirección            | Payload                      |
|------------|----------------------|------------------------------|
| `unirse`   | Cliente → Servidor   | `"nombre"`                   |
| `mensaje`  | Cliente → Servidor   | `"texto"`                    |
| `mensaje`  | Servidor → Todos     | `{ usuario, texto, hora }`   |

## Tecnologías

NestJS · Socket.io v4 · HTML/CSS/JS · Podman · MicroShift (Kubernetes)

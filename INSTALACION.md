# Guía de Instalación y Despliegue

Guía paso a paso para instalar, ejecutar y desplegar el **Chat Distribuido en
Tiempo Real con WebSockets**, tanto en entorno de desarrollo local como en el
clúster **MicroShift** con **Podman**.

---

## 1. Requisitos previos

| Herramienta | Versión mínima | Comprobación | Para qué |
|---|---|---|---|
| **Node.js** | 18 (recomendado 20) | `node --version` | Ejecutar el servidor NestJS |
| **npm** | 9 | `npm --version` | Gestor de dependencias |
| **Git** | 2.x | `git --version` | Clonar y versionar |
| **Podman** | 4.x | `podman --version` | Construir la imagen del contenedor |
| **MicroShift / oc** | 4.x | `oc version` | Orquestar el despliegue (clúster) |

> El desarrollo local solo necesita **Node.js, npm y Git**.
> Podman y MicroShift se usan únicamente para el despliegue en el clúster.

### 1.1 Imágenes de Red Hat (sin Docker Hub)

El proyecto usa exclusivamente registros de Red Hat:

| Imagen | Registro | Login |
|---|---|---|
| `ubi9/nodejs-20` (base del Dockerfile) | `registry.access.redhat.com` | No requiere |
| `rhel9/redis-7` (bus Pub/Sub) | `registry.redhat.io` | **Requiere** cuenta Red Hat |

Como la imagen de Redis vive en `registry.redhat.io`, autentícate en la VM con
tu cuenta de desarrollador Red Hat antes de desplegar:

```bash
podman login registry.redhat.io        # usuario/contraseña de Red Hat
```

MicroShift descarga las imágenes de los pods usando su **pull secret global**
(`/etc/crio/openshift-pull-secret`). Ese secret ya incluye tus credenciales de
Red Hat (es el que configuraste al instalar MicroShift), por lo que los pods
pueden bajar `rhel9/redis-7` sin cambios adicionales. Para comprobarlo:

```bash
sudo grep -o 'registry.redhat.io' /etc/crio/openshift-pull-secret && echo "pull secret OK"
```

> **Alternativa** (si el secret global no tuviera tus credenciales): crea un
> secret en el namespace y refér encialo con `imagePullSecrets`:
> ```bash
> oc create secret docker-registry redhat-pull \
>   --docker-server=registry.redhat.io \
>   --docker-username='TU_USUARIO' --docker-password='TU_TOKEN'
> oc secrets link default redhat-pull --for=pull
> ```

---

## 2. Instalación en desarrollo local

### 2.1 Clonar el repositorio

```bash
git clone https://github.com/USUARIO/chat-distribuido.git
cd chat-distribuido
```

### 2.2 Instalar dependencias

```bash
npm install
```

Esto descarga NestJS, Socket.io y el resto de paquetes definidos en
`package.json`.

### 2.3 Ejecutar el servidor

```bash
# Modo desarrollo (recarga automática al guardar cambios)
npm run start:dev

# Modo producción
npm run build
npm run start:prod
```

El servidor queda disponible en:

```
http://localhost:3000
```

Abre esa URL en **dos pestañas o dispositivos distintos**, escribe un nombre en
cada una y comprueba que los mensajes se difunden en tiempo real entre ambas.

### 2.4 Variables de entorno (opcional)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto en el que escucha el servidor |

```bash
PORT=8080 npm run start:prod   # arranca en el puerto 8080
```

---

## 3. Construcción del contenedor con Podman

En la VM Red Hat, dentro del directorio del proyecto:

```bash
# Construir la imagen a partir del Dockerfile
podman build -t chat-distribuido:latest .

# Verificar que la imagen se creó
podman images | grep chat-distribuido
```

> **Prueba rápida del contenedor (opcional):**
> ```bash
> podman run --rm -p 3000:3000 chat-distribuido:latest
> # luego abre http://localhost:3000
> ```

---

## 4. Despliegue en MicroShift

### 4.1 Verificar el clúster

```bash
oc get nodes          # el nodo debe aparecer en estado Ready
```

Si aparece `NotReady` o el comando falla, arranca MicroShift:

```bash
sudo systemctl start microshift
```

### 4.2 Aplicar los manifiestos

> **Importante:** despliega **Redis primero**. Las réplicas lo usan como bus
> Pub/Sub para compartir los mensajes; sin él, cada pod sería una isla y dos
> usuarios en pods distintos no se verían. Ver la sección 9.
>
> La imagen de Redis viene de `registry.redhat.io`: asegúrate de haber hecho
> `podman login registry.redhat.io` y de tener el pull secret de Red Hat (§1.1).

```bash
oc apply -f k8s/redis.yaml        # bus Pub/Sub compartido (Deployment + Service)
oc apply -f k8s/deployment.yaml   # crea el Deployment del chat con 2 réplicas
oc apply -f k8s/service.yaml      # expone el servicio (NodePort)
```

### 4.3 Esperar a que los pods estén listos

```bash
oc get pods -w
# Espera hasta ver Redis y las dos réplicas del chat en 1/1 Running:
# redis-xxxxx-yyyyy               1/1   Running   0
# chat-distribuido-xxxxx-aaaaa    1/1   Running   0
# chat-distribuido-xxxxx-bbbbb    1/1   Running   0
```

### 4.4 Obtener la URL de acceso

```bash
oc get service chat-service
# NAME           TYPE       CLUSTER-IP     PORT(S)        AGE
# chat-service   NodePort   10.96.0.100    80:31234/TCP   1m
```

Abre el chat en el navegador usando la IP de la VM y el puerto asignado
(rango 30000–32767):

```
http://IP_DE_LA_VM:31234
```

> Si la página no carga, revisa el firewall:
> ```bash
> sudo firewall-cmd --list-ports
> sudo firewall-cmd --add-port=31234/tcp --permanent
> sudo firewall-cmd --reload
> ```

---

## 5. Operación del sistema

### Ver logs

```bash
oc logs -f deployment/chat-distribuido     # logs en tiempo real
oc logs -f <nombre-del-pod>                # un pod concreto
```

### Escalar réplicas

```bash
oc scale deployment/chat-distribuido --replicas=3
oc get pods
```

### Actualizar tras un cambio de código

```bash
git pull origin main
podman build -t chat-distribuido:latest .
oc rollout restart deployment/chat-distribuido
```

---

## 6. Prueba de tolerancia a fallos (chaos test)

```bash
# 1. Confirmar que hay 2 pods activos
oc get pods

# 2. Con usuarios conectados y chateando, eliminar un pod
oc delete pod <uno-de-los-pods>

# 3. Observar la recuperación automática
oc get pods
# MicroShift crea un pod nuevo para mantener replicas=2

# 4. En el navegador, el indicador pasa de
#    "● Conectado" -> "● Reconectando..." -> "● Conectado"
#    y los mensajes siguen fluyendo sin intervención.
```

---

## 7. Compilar la documentación (LaTeX)

La documentación técnica está en `docs/documentacion.tex`.

```bash
cd docs
latexmk -pdf documentacion.tex     # genera docs/documentacion.pdf
```

Requiere una distribución LaTeX (TeX Live) con los paquetes `tikz`, `listings`,
`booktabs`, `tabularx` y `hyperref`.

---

## 8. Solución de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| `npm install` falla | Versión de Node antigua | Actualizar a Node 18+ |
| Pods en `Pending` | Imagen no encontrada | `podman images` y reconstruir |
| Pods en `CrashLoopBackOff` | Error en la app | `oc logs <pod>` para ver el error |
| No se accede al chat | Puerto bloqueado | Abrir el puerto en el firewall |
| `oc get nodes` = `NotReady` | MicroShift detenido | `sudo systemctl start microshift` |
| Dos usuarios no se ven | Redis no desplegado | `oc apply -f k8s/redis.yaml` y reiniciar el chat |
| Una máquina no alcanza al servidor | Red NAT o firewall | Usar red **bridged** y abrir el NodePort |

---

## 9. Pruebas entre varias máquinas / VMs (en hosts distintos)

El servidor corre en **una** VM con MicroShift. Las demás máquinas (físicas o
VMs en otros hosts) actúan como **clientes** y solo necesitan alcanzar por red
la IP y el puerto NodePort del servidor. No hay que cambiar nada del código:
`client.js` se conecta al mismo origen que sirvió la página.

### 9.1 Requisito de red
- Configura las VMs en **modo puente (bridged)** para que tomen una IP de la LAN
  y sean alcanzables entre hosts (con NAT necesitarías *port-forwarding*).
- Todas las máquinas deben estar en la **misma red** y poder hacerse `ping`.

```bash
hostname -I            # IP de cada máquina/VM
ping IP_DEL_SERVIDOR   # comprobar alcance
```

### 9.2 En la VM servidor: abrir el NodePort en el firewall
```bash
oc get service chat-service                              # ver el NodePort
sudo firewall-cmd --permanent --add-port=<NODEPORT>/tcp  # p. ej. 31234
sudo firewall-cmd --reload
```

### 9.3 Desde cada máquina cliente

- **RHEL con interfaz gráfica:** abre Firefox en
  `http://IP_DEL_SERVIDOR:<NODEPORT>`.

- **RHEL solo terminal:** primero verifica el alcance y luego usa el cliente de
  terminal (sección 10):
  ```bash
  ./scripts/verificar-red.sh http://IP_DEL_SERVIDOR:<NODEPORT>
  node cliente-terminal.js http://IP_DEL_SERVIDOR:<NODEPORT> TuNombre
  ```

### 9.4 ¿Por qué Redis es necesario aquí?
Con 2 réplicas detrás del Service, cada pod mantiene sus clientes en memoria.
Si el usuario A queda en el Pod #1 y el B en el Pod #2, **sin Redis no se verían**
(`server.emit()` solo alcanza a los clientes del mismo pod). El adaptador de
Redis (`k8s/redis.yaml` + variable `REDIS_URL`) propaga los mensajes entre todas
las réplicas mediante Pub/Sub, logrando un chat realmente distribuido y de alta
disponibilidad. Además, el cliente usa `transports: ['websocket']` y el Service
`sessionAffinity: ClientIP` para que la conexión sea estable con varias réplicas.

---

## 10. Cliente de terminal (`cliente-terminal.js`)

Para chatear desde una máquina **sin navegador** (RHEL solo terminal).

```bash
# En esa máquina: Node + la dependencia del cliente
npm install socket.io-client      # o 'npm install' si clonaste el repo

# Conectarse al servidor del laboratorio
node cliente-terminal.js http://IP_DEL_SERVIDOR:<NODEPORT> Ana
```

Escribe un mensaje y pulsa **Enter** para enviarlo; **Ctrl+C** para salir.
Los mensajes de otros usuarios (navegador o terminal) aparecen en tiempo real.

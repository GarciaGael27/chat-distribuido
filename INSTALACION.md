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

```bash
oc apply -f k8s/deployment.yaml   # crea el Deployment con 2 réplicas
oc apply -f k8s/service.yaml      # expone el servicio (NodePort)
```

### 4.3 Esperar a que los pods estén listos

```bash
oc get pods -w
# Espera hasta ver dos pods en estado 1/1 Running:
# chat-distribuido-xxxxx-aaaaa   1/1   Running   0
# chat-distribuido-xxxxx-bbbbb   1/1   Running   0
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

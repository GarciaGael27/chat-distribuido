# Imagen base oficial de Red Hat: UBI 9 con Node.js 20.
# Registro público de Red Hat (no requiere login) y pensada para correr sin
# root bajo las políticas de seguridad de MicroShift/OpenShift.
FROM registry.access.redhat.com/ubi9/nodejs-20

# La imagen UBI ya define WORKDIR=/opt/app-root/src y USER 1001 (no root),
# con el grupo 0 como propietario para permitir escritura.

# Copia primero los archivos de dependencias (optimiza la caché de capas).
# --chown=1001:0 da permisos de escritura al usuario por defecto de la imagen.
COPY --chown=1001:0 package*.json ./
RUN npm install

# Copia el resto del código fuente
COPY --chown=1001:0 . .

# Compila TypeScript a JavaScript (genera dist/) y elimina dependencias de
# desarrollo para aligerar la imagen final.
RUN npm run build && npm prune --production

# Puerto que expone el servidor NestJS
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/main"]

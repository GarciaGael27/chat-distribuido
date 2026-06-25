# Imagen base ligera de Node.js 20
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia primero los archivos de dependencias (optimiza la caché de capas)
COPY package*.json ./
RUN npm install

# Copia el resto del código fuente
COPY . .

# Compila TypeScript a JavaScript (genera dist/)
RUN npm run build

# Elimina las dependencias de desarrollo para aligerar la imagen final
RUN npm prune --production

# Puerto que expone el servidor NestJS
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/main"]

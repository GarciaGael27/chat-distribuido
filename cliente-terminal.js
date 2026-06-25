#!/usr/bin/env node
// cliente-terminal.js
// Cliente de chat para la terminal (máquinas RHEL sin interfaz gráfica).
// Usa socket.io-client para hablar el mismo protocolo que el navegador.
//
// Uso:
//   node cliente-terminal.js <URL_DEL_SERVIDOR> <NOMBRE>
// Ejemplos:
//   node cliente-terminal.js http://192.168.1.50:31234 Ana
//   node cliente-terminal.js http://localhost:3000 Luis
//
// Escribe un mensaje y pulsa Enter para enviarlo. Ctrl+C para salir.

const readline = require('readline');

let io;
try {
  io = require('socket.io-client').io;
} catch (e) {
  console.error(
    '\nFalta la dependencia "socket.io-client".\n' +
      'Instálala en este equipo con:  npm install socket.io-client\n',
  );
  process.exit(1);
}

const url = process.argv[2] || 'http://localhost:3000';
const nombre = process.argv[3] || `Usuario-${Math.floor(Math.random() * 1000)}`;

console.log(`\nConectando a ${url} como "${nombre}"...`);

const socket = io(url, {
  reconnection: true,
  reconnectionDelay: 1000,
  transports: ['websocket'],
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let activo = true;

function prompt() {
  if (activo) rl.prompt();
}

function hora(iso) {
  return new Date(iso).toLocaleTimeString();
}

// Se emite ya: socket.io lo guarda en buffer y lo envía en cuanto conecta.
// Así 'unirse' siempre llega antes que cualquier 'mensaje' (preserva el orden).
socket.emit('unirse', nombre);
let primeraConexion = true;

socket.on('connect', () => {
  console.log('● Conectado. Escribe un mensaje y pulsa Enter (Ctrl+C para salir).\n');
  // En reconexiones es un socket nuevo en el servidor: re-registra el nombre.
  // (En la primera conexión ya lo cubre el emit en buffer de arriba.)
  if (!primeraConexion) socket.emit('unirse', nombre);
  primeraConexion = false;
  prompt();
});

socket.on('disconnect', () => {
  console.log('● Reconectando...');
});

socket.on('mensaje', (data) => {
  // Limpia la línea de escritura actual antes de imprimir el mensaje entrante
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);

  if (data.usuario === 'Sistema') {
    console.log(`  -- ${data.texto} --`);
  } else {
    const marca = data.usuario === nombre ? '(yo)' : '';
    console.log(`  [${hora(data.hora)}] ${data.usuario}${marca}: ${data.texto}`);
  }
  prompt();
});

rl.on('line', (linea) => {
  const texto = linea.trim();
  if (texto) socket.emit('mensaje', texto);
  prompt();
});

rl.on('close', () => {
  if (!activo) return;
  activo = false;
  socket.close();
  process.exit(0);
});

rl.on('SIGINT', () => {
  activo = false;
  console.log('\nSaliendo del chat...');
  socket.close();
  process.exit(0);
});

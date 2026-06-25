// public/client.js

// Conexión al servidor WebSocket con reconexión automática
// reconnectionDelay: espera 1 segundo entre intentos de reconexión
const socket = io({ reconnection: true, reconnectionDelay: 1000 });

let miNombre = '';

// Referencias a elementos del DOM
const pantallaInicio     = document.getElementById('pantalla-inicio');
const pantallaChat       = document.getElementById('pantalla-chat');
const inputNombre        = document.getElementById('input-nombre');
const btnEntrar          = document.getElementById('btn-entrar');
const inputMensaje       = document.getElementById('input-mensaje');
const btnEnviar          = document.getElementById('btn-enviar');
const contenedorMensajes = document.getElementById('mensajes');
const estadoConexion     = document.getElementById('estado-conexion');

// El usuario ingresa su nombre y se une al chat
btnEntrar.addEventListener('click', entrar);

// Permite entrar presionando Enter en el campo de nombre
inputNombre.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') entrar();
});

function entrar() {
  const nombre = inputNombre.value.trim();
  if (!nombre) return;
  miNombre = nombre;

  // Emite evento 'unirse' al servidor con el nombre del usuario
  socket.emit('unirse', nombre);

  pantallaInicio.classList.add('oculto');
  pantallaChat.classList.remove('oculto');
  inputMensaje.focus();
}

btnEnviar.addEventListener('click', enviarMensaje);

// Permite enviar mensajes presionando Enter
inputMensaje.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') enviarMensaje();
});

function enviarMensaje() {
  const texto = inputMensaje.value.trim();
  if (!texto) return;

  // Emite evento 'mensaje' al servidor con el texto
  socket.emit('mensaje', texto);
  inputMensaje.value = '';
}

// Escucha mensajes entrantes del servidor (broadcast)
socket.on('mensaje', (data) => {
  const div = document.createElement('div');

  if (data.usuario === 'Sistema') {
    // Mensajes del sistema (entró/salió)
    div.classList.add('mensaje', 'sistema');
    div.textContent = data.texto;
  } else {
    div.classList.add('mensaje');

    // Resalta los mensajes propios
    if (data.usuario === miNombre) div.classList.add('propio');

    const hora = new Date(data.hora).toLocaleTimeString();
    div.innerHTML = `
      <div class="mensaje-usuario">${data.usuario} · ${hora}</div>
      <div>${escaparHtml(data.texto)}</div>
    `;
  }

  contenedorMensajes.appendChild(div);
  // Desplaza automáticamente al último mensaje
  contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
});

// Indicador visual de conexión — muestra reconexión durante el chaos test
socket.on('connect', () => {
  estadoConexion.textContent = '● Conectado';
  estadoConexion.className = 'conectado';

  // Si el usuario ya había ingresado su nombre, lo re-registra tras reconectar
  if (miNombre) socket.emit('unirse', miNombre);
});

socket.on('disconnect', () => {
  estadoConexion.textContent = '● Reconectando...';
  estadoConexion.className = 'desconectado';
});

// Evita inyección de HTML en el texto de los mensajes
function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

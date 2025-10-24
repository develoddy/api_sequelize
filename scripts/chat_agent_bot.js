import { io } from 'socket.io-client';

// Config (puedes ajustar con variables de entorno)
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3500';
const AGENT_ID = process.env.AGENT_ID || 'autobot_1';
const AGENT_NAME = process.env.AGENT_NAME || 'AutoBot';
const REPLY_DELAY = parseInt(process.env.REPLY_DELAY || '800', 10); // ms
const AUTO_MARK_READ = process.env.AUTO_MARK_READ !== 'false'; // default true
const AUTO_CLOSE_AFTER = parseInt(process.env.AUTO_CLOSE_AFTER || '0', 10); // seconds, 0 = disabled

console.log('Chat Agent Bot starting', { SERVER_URL, AGENT_ID, AGENT_NAME, REPLY_DELAY, AUTO_MARK_READ, AUTO_CLOSE_AFTER });

const socket = io(SERVER_URL, { transports: ['websocket'] });

const activeConversations = new Map(); // session_id -> conversation_id

function generateReply(userMessage) {
  // Simple reply logic: canned answers or echo
  const text = (userMessage || '').toLowerCase();
  if (text.includes('hola') || text.includes('buenas')) return 'Hola! Soy un agente automático. ¿En qué puedo ayudarte?';
  if (text.includes('pedido') || text.includes('envío')) return 'Entiendo. ¿Puedes darme tu número de pedido o más detalles del envío?';
  if (text.includes('precio') || text.includes('coste')) return 'El precio lo puedes consultar en la ficha del producto. ¿Quieres que busque por nombre?';
  // default echo
  return `Recibí tu mensaje: "${userMessage}" — un agente humano te responderá pronto.`;
}

socket.on('connect', () => {
  console.log('[BOT] connected', socket.id);
  // identify as agent
  socket.emit('identify-agent', { agent_id: AGENT_ID, agent_name: AGENT_NAME });
});

socket.on('disconnect', (reason) => {
  console.log('[BOT] disconnected', reason);
});

socket.on('connect_error', (err) => {
  console.error('[BOT] connect_error', err.message || err);
});

socket.on('agent-registered', (data) => {
  console.log('[BOT] registered as agent:', data);
});

socket.on('user-connected', (data) => {
  console.log('[BOT] user-connected', data);
});

socket.on('new-user-message', (msg) => {
  try {
    console.log('[BOT] new-user-message', msg);
    const { session_id, conversation_id, message } = msg;
    if (!conversation_id || !session_id) {
      console.warn('[BOT] missing conversation_id or session_id, skipping');
      return;
    }

    // remember conversation
    activeConversations.set(session_id, conversation_id);

    // simulate typing indicator
    socket.emit('typing', { conversation_id, session_id, is_agent: true, user_name: AGENT_NAME });

    setTimeout(() => {
      // stop typing
      socket.emit('stopped-typing', { conversation_id, session_id, is_agent: true });

      const reply = generateReply(message);
      console.log(`[BOT] replying to session ${session_id} (conv ${conversation_id}):`, reply);

      socket.emit('agent-message', {
        conversation_id,
        session_id,
        agent_id: AGENT_ID,
        message: reply
      });

      // mark read if configured
      if (AUTO_MARK_READ) {
        setTimeout(() => {
          socket.emit('mark-read', { conversation_id, session_id, reader_type: 'agent' });
          console.log(`[BOT] marked messages as read for conv ${conversation_id}`);
        }, 300);
      }

      // optionally close after some seconds
      if (AUTO_CLOSE_AFTER > 0) {
        setTimeout(() => {
          socket.emit('close-conversation', { conversation_id, session_id });
          console.log(`[BOT] closed conversation ${conversation_id}`);
        }, AUTO_CLOSE_AFTER * 1000);
      }
    }, REPLY_DELAY);
  } catch (err) {
    console.error('[BOT] error handling new-user-message', err);
  }
});

socket.on('new-agent-message', (msg) => {
  // other agents' messages
  console.log('[BOT] new-agent-message', msg);
});

socket.on('new-message', (msg) => {
  // any message in a session room (includes both user and agent)
  console.log('[BOT] new-message (room)', msg);
});

socket.on('conversation-ready', (data) => {
  console.log('[BOT] conversation-ready', data);
  if (data && data.session_id && data.conversation_id) {
    activeConversations.set(data.session_id, data.conversation_id);
  }
});

socket.on('chat-history', (data) => {
  console.log('[BOT] chat-history', data.conversation_id, 'messages:', (data.messages || []).length);
});

socket.on('agent-joined', (data) => {
  console.log('[BOT] agent-joined', data);
});

socket.on('typing-update', (data) => {
  console.log('[BOT] typing-update', data);
});

socket.on('conversation-closed', (data) => {
  console.log('[BOT] conversation-closed', data);
  if (data && data.session_id) {
    activeConversations.delete(data.session_id);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[BOT] shutting down...');
  socket.disconnect();
  process.exit(0);
});

// Helper: expose a simple REPL-like command listener via stdin for manual commands
import readline from 'readline';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const [cmd, ...rest] = trimmed.split(' ');
  if (cmd === 'list') {
    console.log('Active conversations:', Array.from(activeConversations.entries()));
  } else if (cmd === 'say') {
    // say <session_id> <message>
    const [sessionId, ...msgParts] = rest;
    const msg = msgParts.join(' ');
    const convId = activeConversations.get(sessionId);
    if (!convId) return console.warn('Unknown session', sessionId);
    socket.emit('agent-message', { conversation_id: convId, session_id: sessionId, agent_id: AGENT_ID, message: msg });
    console.log('[BOT] manual send to', sessionId, msg);
  } else if (cmd === 'close') {
    const [sessionId] = rest;
    const convId = activeConversations.get(sessionId);
    if (!convId) return console.warn('Unknown session', sessionId);
    socket.emit('close-conversation', { conversation_id: convId, session_id: sessionId });
    console.log('[BOT] manual close', convId);
  } else if (cmd === 'help') {
    console.log('Commands: list | say <session_id> <message> | close <session_id> | help');
  } else {
    console.log('Unknown command. Type help');
  }
});

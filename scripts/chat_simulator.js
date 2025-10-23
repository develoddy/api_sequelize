import { io } from 'socket.io-client';

// Config
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3500';

function randSessionId() {
  return 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

async function runSimulation() {
  const sessionId = randSessionId();
  console.log('Using session id:', sessionId);

  const userSocket = io(SERVER_URL, { transports: ['websocket'] });
  const agentSocket = io(SERVER_URL, { transports: ['websocket'] });

  let conversationId = null;

  // User event handlers
  userSocket.on('connect', () => {
    console.log('[USER] connected', userSocket.id);
    userSocket.emit('identify-user', { session_id: sessionId, guest_id: 'guest_sim' });
  });

  userSocket.on('conversation-ready', (data) => {
    console.log('[USER] conversation-ready', data);
    conversationId = data.conversation_id;

    // Send a user message after short delay
    setTimeout(() => {
      console.log('[USER] sending message');
      userSocket.emit('user-message', {
        conversation_id: conversationId,
        session_id: sessionId,
        guest_id: 'guest_sim',
        message: 'Hola, necesito ayuda con un pedido (simulator esm)'
      });
    }, 500);
  });

  userSocket.on('new-message', (msg) => {
    console.log('[USER] new-message', msg);
  });

  userSocket.on('agent-joined', (data) => {
    console.log('[USER] agent-joined', data);
  });

  userSocket.on('typing-update', (data) => {
    console.log('[USER] typing-update', data);
  });

  userSocket.on('conversation-closed', (data) => {
    console.log('[USER] conversation-closed', data);
    cleanup();
  });

  userSocket.on('chat-history', (data) => {
    console.log('[USER] chat-history', data.messages.length, 'messages');
  });

  userSocket.on('error', (err) => {
    console.error('[USER] socket error', err);
  });

  // Agent event handlers
  agentSocket.on('connect', () => {
    console.log('[AGENT] connected', agentSocket.id);
    agentSocket.emit('identify-agent', { agent_id: 'agent_sim', agent_name: 'Agent Sim' });
  });

  agentSocket.on('agent-registered', (data) => {
    console.log('[AGENT] registered', data);
  });

  agentSocket.on('new-user-message', (msg) => {
    console.log('[AGENT] new-user-message', msg);
    // Take the conversation
    setTimeout(() => {
      console.log('[AGENT] taking conversation');
      agentSocket.emit('take-conversation', {
        conversation_id: msg.conversation_id,
        agent_id: 'agent_sim',
        agent_name: 'Agent Sim',
        session_id: sessionId
      });

      // Reply as agent
      setTimeout(() => {
        console.log('[AGENT] sending reply');
        agentSocket.emit('agent-message', {
          conversation_id: msg.conversation_id,
          session_id: sessionId,
          agent_id: 'agent_sim',
          message: 'Hola, soy un agente simulado. ¿En qué puedo ayudarte? (esm)'
        });
      }, 500);
    }, 500);
  });

  agentSocket.on('new-agent-message', (msg) => {
    console.log('[AGENT] new-agent-message', msg);
  });

  agentSocket.on('conversation-taken', (data) => {
    console.log('[AGENT] conversation-taken', data);
  });

  agentSocket.on('error', (err) => {
    console.error('[AGENT] socket error', err);
  });

  // Helper to request history and mark read, then close
  function afterDelayActions() {
    if (!conversationId) conversationId = null;
    setTimeout(() => {
      if (!conversationId) return;
      console.log('[SIM] requesting history');
      agentSocket.emit('get-history', { conversation_id: conversationId });

      setTimeout(() => {
        console.log('[SIM] marking messages as read (agent)');
        agentSocket.emit('mark-read', { conversation_id: conversationId, reader_type: 'agent', session_id: sessionId });

        setTimeout(() => {
          console.log('[SIM] agent closing conversation');
          agentSocket.emit('close-conversation', { conversation_id: conversationId, session_id: sessionId });
        }, 800);
      }, 800);
    }, 3000);
  }

  // When agent registered and conversation exists, run afterDelayActions
  agentSocket.on('agent-registered', () => {
    // Start after a small delay to allow user to send message
    setTimeout(afterDelayActions, 2000);
  });

  function cleanup() {
    try {
      userSocket.disconnect();
      agentSocket.disconnect();
    } catch (e) {}
    setTimeout(() => process.exit(0), 500);
  }
}

runSimulation().catch(err => {
  console.error('Simulation error', err);
  process.exit(1);
});


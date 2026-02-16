# 🚀 SMART CHAT SAAS - Inicio Rápido

## ⚡ Quick Start (3 minutos)

### Opción 1: Setup Automático (Recomendado)

```bash
cd /Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api
./setup-smart-chat.sh
```

Este script:
- ✅ Ejecuta la migración multi-tenant
- ✅ Inicia el servidor
- ✅ Prueba los endpoints
- ✅ Abre la página de pruebas en el navegador

### Opción 2: Setup Manual

```bash
# 1. Ejecutar migración
npm run db:migrate:dev

# 2. Iniciar servidor
npm run dev

# 3. En otra terminal, probar endpoints
./test-endpoints.sh

# 4. Abrir navegador
open http://localhost:3500/test-multi-tenant-chat.html
```

---

## 📋 Verificación Rápida

### 1. Verificar migración ejecutada

```sql
mysql -u root -p
USE ecommerce_db;

-- Debe mostrar tenant_agents y tenant_chat_config
SHOW TABLES LIKE 'tenant_%';

-- Debe tener columna tenant_id
DESCRIBE chat_conversations;
DESCRIBE chat_messages;
```

### 2. Probar endpoints REST

```bash
# Si el servidor está corriendo, ejecuta:
./test-endpoints.sh
```

Debería mostrar:
```
✅ TODOS LOS TESTS PASARON
🎉 El backend multi-tenant está funcionando correctamente
```

### 3. Probar Socket.IO

Abre en el navegador:
```
http://localhost:3500/test-multi-tenant-chat.html
```

1. Click en "Connect to Tenant 1"
2. Envía un mensaje: "Hola desde tenant 1"
3. Verifica en MySQL:

```sql
SELECT * FROM chat_messages ORDER BY id DESC LIMIT 5;
```

Debería ver el mensaje con `tenant_id = 1`

---

## 🎯 Estructura del Proyecto

### Archivos Nuevos Creados

**Backend Multi-Tenant:**
```
api/
├── migrations/
│   └── 20260216000000-add-chat-multi-tenant.cjs  # Migración multi-tenant
├── src/
│   ├── models/chat/
│   │   ├── TenantChatConfig.js                   # Config por tenant
│   │   └── TenantAgent.js                         # Agentes por tenant
│   ├── middlewares/
│   │   └── tenant-auth.middleware.js              # Auth multi-tenant
│   ├── controllers/chat/
│   │   ├── chat-tenant.controller.js              # REST endpoints
│   │   └── socket-tenant.controller.js            # Socket.IO namespaces
│   └── routes/
│       └── chat-tenant.routes.js                  # Routes multi-tenant
├── public/
│   └── test-multi-tenant-chat.html                # Página de pruebas
├── setup-smart-chat.sh                            # Setup automático
└── test-endpoints.sh                              # Test de endpoints
```

**Documentación:**
```
ECOMMERCE-MEAN/
├── SMART-CHAT-SAAS-ACTION-PLAN.md    # Plan completo 3 sprints
├── SMART-CHAT-PITCH-DECK.md          # Pitch de negocio
├── QUICK-START-MVP.md                 # Guía paso a paso
└── VERIFICACION-COMPLETA.md           # Verificación manual
```

### Archivos Modificados

**Integración Multi-Tenant:**
```
api/src/
├── index.js                          # ✏️ Imports de modelos tenant
├── socket.js                         # ✏️ Setup multi-tenant socket
├── routes/index.js                   # ✏️ Routes multi-tenant
├── services/chat/chat.service.js     # ✏️ tenant_id required
└── controllers/chat/socket.controller.js  # ✏️ tenant_id = 1 for ecommerce
```

---

## 🧪 Endpoints Multi-Tenant

### REST API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/chat/tenant/config` | Obtener configuración del tenant |
| PUT | `/api/chat/tenant/config` | Actualizar configuración |
| GET | `/api/chat/tenant/conversations` | Listar conversaciones |
| GET | `/api/chat/tenant/conversations/:id/messages` | Mensajes de conversación |
| POST | `/api/chat/tenant/messages/send` | Enviar mensaje |
| GET | `/api/chat/tenant/stats` | Estadísticas del tenant |
| GET | `/api/chat/tenant/agents` | Listar agentes |
| POST | `/api/chat/tenant/agents` | Invitar agente |

**Autenticación:**
Todos los endpoints requieren header `X-Tenant-Id: 1`

### Socket.IO

**Namespaces dinámicos:**
```javascript
// Conectar a tenant 1
const socket = io('http://localhost:3500/tenant-1');

// Conectar a tenant 2
const socket = io('http://localhost:3500/tenant-2');
```

**Eventos:**
- `identify-user` - Identificar usuario
- `identify-agent` - Identificar agente
- `user-message` - Mensaje de usuario
- `agent-message` - Mensaje de agente
- `typing` - Indicador de escritura
- `agent-joined` - Agente se unió
- `agent-left` - Agente salió

---

## 📊 Modelos

### TenantChatConfig

Configuración del chat por tenant:

```javascript
{
  tenant_id: 1,
  widget_color: '#007bff',
  widget_position: 'bottom-right',
  welcome_message: '¡Hola! ¿En qué podemos ayudarte?',
  business_hours: {
    monday: { open: '09:00', close: '18:00', enabled: true },
    // ...
  },
  timezone: 'Europe/Madrid',
  auto_response_enabled: true,
  allowed_domains: ['*'],
  integration_type: 'iframe', // iframe | crisp | intercom | native
  max_agents: 5
}
```

### TenantAgent

Agentes del tenant:

```javascript
{
  tenant_id: 1,
  agent_name: 'John Doe',
  agent_email: 'john@example.com',
  status: 'active',  // active | inactive | invited
  role: 'owner',     // owner | agent | agent_readonly
  invite_token: 'abc123',
  invite_expires_at: '2025-03-01 12:00:00'
}
```

### ChatConversation (Modificado)

Ahora incluye `tenant_id`:

```javascript
{
  id: 1,
  tenant_id: 1,  // NUEVO
  user_name: 'Cliente',
  user_email: 'cliente@example.com',
  status: 'active',
  last_message_at: '2025-02-16 10:30:00'
}
```

### ChatMessage (Modificado)

Ahora incluye `tenant_id`:

```javascript
{
  id: 1,
  conversation_id: 1,
  tenant_id: 1,  // NUEVO
  sender_type: 'user',
  sender_name: 'Cliente',
  message_text: 'Hola, necesito ayuda'
}
```

---

## 🔧 Troubleshooting

### Migración falla

**Error:** `Table 'tenant_chat_config' already exists`

**Solución:**
```bash
# Verificar estado de migraciones
npm run db:migrate:status

# Si está en error, deshacer última migración
npm run db:migrate:undo

# Volver a ejecutar
npm run db:migrate:dev
```

### Puerto 3500 ocupado

**Solución:**
```bash
# Encontrar proceso
lsof -i :3500

# Matar proceso
kill -9 <PID>

# O cambiar puerto
export PORT=3501
npm run dev
```

### Endpoints retornan 401 "tenant_id is required"

**Solución:**
```bash
# INCORRECTO
curl http://localhost:3500/api/chat/tenant/config

# CORRECTO
curl -H "X-Tenant-Id: 1" http://localhost:3500/api/chat/tenant/config
```

### Socket.IO no conecta

**Verificar:**
1. Servidor corriendo: `ps aux | grep node`
2. Console del navegador (F12) → Buscar errores
3. URL correcta: `http://localhost:3500/tenant-1`

---

## 📚 Documentación Completa

- **[QUICK-START-MVP.md](../QUICK-START-MVP.md)** - Guía paso a paso completa
- **[SMART-CHAT-SAAS-ACTION-PLAN.md](../SMART-CHAT-SAAS-ACTION-PLAN.md)** - Plan de 3 sprints
- **[SMART-CHAT-PITCH-DECK.md](../SMART-CHAT-PITCH-DECK.md)** - Estrategia de negocio
- **[VERIFICACION-COMPLETA.md](../VERIFICACION-COMPLETA.md)** - Verificación detallada

---

## 🎯 Estado Actual

### ✅ Completado (Sprint 1 - Backend)

- [x] Análisis de arquitectura existente
- [x] Diseño de arquitectura multi-tenant
- [x] Migración de base de datos
- [x] Modelos Sequelize (TenantChatConfig, TenantAgent)
- [x] Middleware de autenticación
- [x] Controllers REST (8 endpoints)
- [x] Socket.IO multi-tenant (namespaces dinámicos)
- [x] Integración con código existente
- [x] Backward compatibility (ecommerce usa tenant_id = 1)
- [x] Página de pruebas HTML
- [x] Scripts de setup y testing
- [x] Documentación completa

### 🚧 Siguiente (Sprint 1 - Frontend)

- [ ] Módulo Angular en app-saas
- [ ] Wizard de onboarding (3 pasos)
- [ ] Dashboard con estadísticas
- [ ] Gestión de conversaciones
- [ ] Panel de configuración
- [ ] Iframe embeddable

### ⏳ Futuro (Sprint 2-3)

- [ ] Features premium (auto-respuestas, horarios, etc.)
- [ ] Integraciones (Crisp, Intercom)
- [ ] Widget nativo personalizable
- [ ] Analytics avanzados
- [ ] Sistema de pagos

---

## ⚡ Comandos Rápidos

```bash
# Setup completo
./setup-smart-chat.sh

# Test endpoints
./test-endpoints.sh

# Iniciar servidor
npm run dev

# Ver logs
tail -f /tmp/smart-chat-server.log

# Conectar a MySQL
mysql -u root -p ecommerce_db

# Verificar tablas
mysql -u root -p -e "USE ecommerce_db; SHOW TABLES LIKE 'tenant_%';"

# Ver últimos mensajes
mysql -u root -p -e "USE ecommerce_db; SELECT * FROM chat_messages ORDER BY id DESC LIMIT 10;"
```

---

## 🤝 Soporte

Si tienes problemas:

1. **Revisa logs del servidor:**
   ```bash
   tail -f /tmp/smart-chat-server.log
   ```

2. **Ejecuta diagnóstico:**
   ```bash
   ./test-endpoints.sh
   ```

3. **Verifica MySQL:**
   ```sql
   USE ecommerce_db;
   SHOW TABLES;
   DESCRIBE chat_conversations;
   SELECT * FROM SequelizeMeta;
   ```

4. **Consulta documentación:**
   - [VERIFICACION-COMPLETA.md](../VERIFICACION-COMPLETA.md) - Troubleshooting detallado
   - [QUICK-START-MVP.md](../QUICK-START-MVP.md) - Guía paso a paso

---

## 🚀 ¡Listo para Lanzar!

Con este README tienes todo lo necesario para:

1. ✅ Ejecutar el setup en 3 minutos
2. ✅ Verificar que todo funciona
3. ✅ Probar el chat multi-tenant
4. ✅ Consultar documentación
5. ✅ Resolver problemas comunes

**Siguiente paso:** Ejecutar `./setup-smart-chat.sh` y empezar a trabajar en el frontend de app-saas.

**¡Vamos a convertir este chat en un producto SaaS rentable! 💪**

# 🚀 MailFlow API - MVP Mode Documentation

**Status:** ⚠️ ACTIVE - Public Validation Phase  
**Date:** 2026-05-05  
**Do NOT revert yet**

---

## 📊 Current State

MailFlow API is running in **MVP PUBLIC MODE** for market validation.

### Key Changes from Normal Architecture:

#### ❌ Removed (Temporarily):
- `requireTenant` middleware on all MailFlow routes
- Authentication requirements
- Multi-tenant isolation
- User/tenant context validation

#### ✅ Added (MVP Only):
- Public API endpoints (no auth)
- localStorage-based sequence identification
- `?sequenceIds` query param support in `listSequences()`
- `tenantId: null` for sequences created without auth

---

## 🔧 Modified Files

### 1. Routes (`/api/src/domains/mailflow/routes/mailflow.routes.js`)

**BEFORE:**
```javascript
router.post('/sequences/generate', requireTenant, generateOnboardingSequence);
router.get('/sequences', requireTenant, listSequences);
// ... all routes protected
```

**NOW (MVP MODE):**
```javascript
router.post('/sequences/generate', generateOnboardingSequence); // No auth
router.get('/sequences', listSequences); // No auth
// ... all routes public
```

**FUTURE (Production):**
```javascript
router.post('/sequences/generate', requireTenant, generateOnboardingSequence);
router.get('/sequences', requireTenant, listSequences);
// ... all routes protected again
```

---

### 2. Controllers (`/api/src/domains/mailflow/controllers/mailflow.controller.js`)

#### `generateOnboardingSequence()`
**Current behavior:**
```javascript
tenantId: req.user?.tenantId || null, // MVP: allows null
userId: req.user?.id || null,         // MVP: allows null
```

**Production behavior:**
```javascript
tenantId: req.user.tenantId, // Required
userId: req.user.id,         // Required
```

---

#### `listSequences()`
**Current behavior (MVP MODE):**
```javascript
// Multi-tenant mode: filter by tenantId or userId
if (req.user?.tenantId) {
    where.tenantId = req.user.tenantId;
} else if (req.user?.id) {
    where.userId = req.user.id;
} else {
    // MVP PUBLIC MODE: use sequenceIds from query param
    const { sequenceIds } = req.query;
    
    if (!sequenceIds) {
        return res.json({ status: 200, data: [] }); // Safe: empty
    }
    
    const idsArray = sequenceIds.split(',').filter(id => id.trim());
    where.sequenceId = idsArray; // Filter by IDs from localStorage
}
```

**How Frontend Uses This:**
```javascript
// Frontend sends:
GET /api/mailflow/sequences?sequenceIds=seq_abc123,seq_xyz456

// Backend returns:
{
  status: 200,
  data: [
    { sequenceId: 'seq_abc123', name: 'Welcome Sequence', ... },
    { sequenceId: 'seq_xyz456', name: 'Onboarding Flow', ... }
  ]
}
```

**Production behavior:**
```javascript
// Always filter by tenantId (workspace isolation)
where.tenantId = req.user.tenantId;

// No sequenceIds query param support
// No localStorage-based identification
```

---

## 🔐 Security Model (MVP Mode)

### How It Works:
1. User creates sequence via `/sequences/generate`
2. Backend creates sequence with `tenantId: null`, `userId: null`
3. Backend returns `sequenceId` to frontend
4. Frontend saves `sequenceId` to localStorage
5. User visits dashboard → Frontend sends `?sequenceIds=...` from localStorage
6. Backend returns **ONLY** those specific sequences

### Why This Is Safe:
- ✅ Without `sequenceIds` param → Returns empty array
- ✅ Only sequences with IDs in localStorage are accessible
- ✅ No way to list ALL sequences (no tenantId = no wildcard)
- ✅ Each sequence isolated by unique ID
- ✅ No cross-user data leakage

### Attack Vectors (Mitigated):
| Attack | Mitigation |
|--------|-----------|
| "List all sequences" | No sequenceIds = empty array |
| "Guess other users' IDs" | sequenceId is UUID (crypto.randomBytes), ~impossible to guess |
| "SQL injection via sequenceIds" | Sequelize ORM prevents injection |
| "Access without frontend" | Can only access if you know sequenceId (same as auth token) |

### Limitations (Acceptable for MVP):
- ❌ If sequenceId leaks → Anyone can access that sequence
- ❌ No audit trail (who created/modified)
- ❌ No soft delete (can't recover sequences)
- ❌ No rate limiting (could spam sequence creation)

**Note:** These are OKAY for MVP validation. Will be fixed in Production mode.

---

## 📈 Cron Job (Unchanged)

The email sender cron (`/api/src/domains/mailflow/cron/mailflow-sender.cron.js`) is **NOT affected** by MVP mode.

**Why:**
- Cron operates on sequences already in DB
- Doesn't care about tenantId or userId
- Just processes `status='active'` and `nextEmailAt <= NOW`

**Current behavior (works in both modes):**
```javascript
// Finds all active contacts with emails pending
const contacts = await MailflowContact.findAll({
  where: {
    status: 'active',
    nextEmailAt: { [Op.lte]: new Date() }
  },
  include: [{ model: MailflowSequence, as: 'MailflowSequence', where: { status: 'active' } }]
});

// Sends emails regardless of tenantId
```

---

## 🚫 DO NOT (Until Validation Phase Ends)

- ❌ Add `requireTenant` back to routes
- ❌ Remove `?sequenceIds` support from `listSequences()`
- ❌ Make `tenantId` required in `generateOnboardingSequence()`
- ❌ Add rate limiting (would block early adopters)
- ❌ Change database schema (add NOT NULL constraints to tenantId)

---

## ✅ FUTURE: Production SaaS Mode

### Backend Changes Needed:

#### 1. Routes
```javascript
// Restore authentication on all routes
import { requireTenant } from '../../../middlewares/tenant-auth.middleware.js';

router.post('/sequences/generate', requireTenant, generateOnboardingSequence);
router.get('/sequences', requireTenant, listSequences);
router.get('/sequences/:sequenceId', requireTenant, getSequence);
router.post('/sequences/:sequenceId/activate', requireTenant, activateSequence);
router.post('/sequences/:sequenceId/pause', requireTenant, pauseSequence);
router.patch('/sequences/:sequenceId/emails/:emailOrder', requireTenant, updateSequenceEmail);
```

#### 2. Controllers
```javascript
// generateOnboardingSequence
tenantId: req.user.tenantId, // Required, not optional
userId: req.user.id,         // Required, not optional

// listSequences - REMOVE sequenceIds support
export const listSequences = async (req, res) => {
    const where = { tenantId: req.user.tenantId }; // Always filter by tenant
    
    const sequences = await MailflowSequence.findAll({
        where,
        order: [['createdAt', 'DESC']]
    });
    
    return res.json({ status: 200, data: sequences });
};
```

#### 3. Database
```sql
-- Add NOT NULL constraints (after data migration)
ALTER TABLE mailflow_sequences 
  MODIFY COLUMN tenantId INT NOT NULL,
  MODIFY COLUMN userId INT NOT NULL;

-- Add indexes for performance
CREATE INDEX idx_mailflow_sequences_tenant ON mailflow_sequences(tenantId);
CREATE INDEX idx_mailflow_contacts_sequence ON mailflow_contacts(sequenceId);
```

#### 4. Middleware
```javascript
// Ensure requireTenant validates:
// - JWT token present
// - Token valid
// - User has active subscription
// - Workspace exists
```

---

## 📋 Migration Checklist

Before switching to Production mode:

- [ ] Frontend auth integrated (Auth0 / Clerk / Firebase)
- [ ] All existing sequences assigned to tenants (data migration)
- [ ] Billing integration tested (Stripe)
- [ ] Multi-tenant tests passing
- [ ] Rate limiting configured
- [ ] Audit logging implemented
- [ ] Backup/restore procedures tested
- [ ] Performance testing with multi-tenant queries
- [ ] Security audit completed

---

## 🎯 Success Criteria

**MVP is successful if:**
1. ✅ 10+ users created sequences
2. ✅ 5+ users activated sequences
3. ✅ Emails delivered successfully (cron working)
4. ✅ Positive pricing validation responses
5. ✅ No critical bugs reported

**Then:** Proceed to Production mode implementation  
**Otherwise:** Pivot on product concept

---

## 📞 Questions?

**Remember:** This is a VALIDATION phase. We're testing:

> "Would someone pay $19/mo for simple email automation without Mailchimp?"

Infrastructure perfection can wait until we know people want this.

---

**Last updated:** 2026-05-05  
**Phase:** MVP Public Validation  
**Status:** ACTIVE - Do not revert yet  
**Timeline:** Review after 10-50 real users

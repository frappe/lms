# AI Assistant Extraction Roadmap - Phased Migration to Standalone Module

**Project:** Frappe LMS AI Assistant Licensing Separation  
**Owner:** Jamie Ontiveros  
**Date:** 2025-01-16  
**Timeline:** 16-18 weeks total  
**Goal:** Extract tightly-coupled AI Assistant into standalone module to avoid AGPL-3.0 obligations

---

## Executive Summary

This document outlines the complete migration strategy to extract the AI Assistant from the tightly-coupled Frappe LMS implementation into a standalone, MIT-licensed module. We use the "Strangler Fig Pattern" to gradually replace the existing system while maintaining full functionality throughout the migration.

**Current State:** 42 AI files deeply integrated into 407-file LMS codebase (10.3% coupling)  
**Target State:** Clean separation with HTTP API boundaries and independent licensing

---

## Table of Contents

1. [Migration Strategy](#migration-strategy)
2. [Phase 0: Assessment & Preparation](#phase-0-assessment--preparation)
3. [Phase 1: Parallel Architecture](#phase-1-parallel-architecture)
4. [Phase 2: Incremental Migration](#phase-2-incremental-migration) 
5. [Phase 3: Complete Extraction](#phase-3-complete-extraction)
6. [Phase 4: Cleanup & Optimization](#phase-4-cleanup--optimization)
7. [Risk Management](#risk-management)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Architecture](#deployment-architecture)
10. [Success Metrics](#success-metrics)

---

## Migration Strategy

### Core Principles

1. **Zero Downtime:** Current system remains fully functional throughout migration
2. **Incremental Validation:** Each component tested in isolation before replacement
3. **Feature Parity:** New system matches all existing functionality
4. **Clean Separation:** HTTP API boundaries prevent tight coupling
5. **Independent Licensing:** Standalone components use MIT/Apache 2.0 licensing

### Architectural Pattern: Strangler Fig

```
Current (Monolithic):
┌─────────────────────────────────┐
│         Frappe LMS              │
│  ┌─────────┐  ┌─────────────┐   │
│  │   LMS   │  │ AI Assistant│   │ ← TIGHTLY COUPLED
│  │  Core   │  │   (42 files)│   │   (AGPL-3.0 bound)
│  └─────────┘  └─────────────┘   │
└─────────────────────────────────┘

Target (Microservices):
┌─────────────┐    HTTP API    ┌─────────────────┐
│ Frappe LMS  │◄──────────────►│ AI Assistant    │
│ (Clean Core)│                │ Standalone App  │ ← LOOSELY COUPLED  
│ AGPL-3.0    │                │ MIT License     │   (License freedom)
└─────────────┘                └─────────────────┘
                                        │
                                HTTP API│
                                        ▼
                               ┌─────────────────┐
                               │   AI Proxy      │
                               │   Service       │
                               │ MIT License     │
                               └─────────────────┘
```

---

## Phase 0: Assessment & Preparation

**Duration:** 2 weeks  
**Goal:** Complete analysis and architecture design

### Week 1: Deep Coupling Analysis

#### Day 1-2: Current State Documentation
```bash
# Document all AI integration points
find . -path "./lms/*" -name "*.py" | grep -E "(ai|chat|assistant)" > ai_files_list.txt

# Analyze import dependencies  
grep -r "from lms.lms.ai_" lms/ > ai_imports.txt
grep -r "import.*ai_" lms/ >> ai_imports.txt

# Document database schema dependencies
frappe --site lms.localhost export-doc "DocType" ai_chat_session > schemas/ai_chat_session.json
frappe --site lms.localhost export-doc "DocType" ai_assistant_config > schemas/ai_assistant_config.json
# ... repeat for all 15 AI DocTypes
```

#### Day 3-4: API Surface Mapping
Document every endpoint and hook:

```python
# Current AI API endpoints in lms/lms/api.py:
CURRENT_AI_ENDPOINTS = [
    "chatbot_reply",
    "chatbot_reply_stream", 
    "get_chat_history",
    "get_assistant_limits",
    "is_assistant_enabled",
    "rebuild_lesson_index",
    "rebuild_course_index",
    "compute_lesson_embeddings",
    "compute_course_embeddings",
    "index_external_source"
]

# Current scheduler hooks in hooks.py:
CURRENT_AI_HOOKS = [
    "lms.lms.api.check_proxy_alerts",        # hourly
    "lms.lms.ai_rag.backfill_embeddings_daily"  # daily
]
```

#### Day 5: Frontend Integration Analysis
```bash
# Find all frontend AI components
find frontend/ -name "*.vue" -exec grep -l "chat\|assistant\|ai" {} \;

# Document current chat panel integration points
grep -r "ChatbotPanel" frontend/src/
```

### Week 2: Architecture Design

#### Day 1-3: API Contract Design
Design clean HTTP API contracts:

```yaml
# api_contracts.yaml
AI_Assistant_API:
  base_url: "http://ai-assistant-service:8001"
  endpoints:
    chat:
      path: "/api/v1/chat/completions"
      method: "POST"
      request_schema: "OpenAI ChatCompletion"
      response_schema: "OpenAI ChatCompletion"
    
    limits:
      path: "/api/v1/users/{user_id}/limits"
      method: "GET"
      response_schema: "UserLimits"
    
    history:
      path: "/api/v1/sessions/{course_id}/{lesson_id}/history"
      method: "GET"
      response_schema: "ChatHistory"

AI_Proxy_API:
  base_url: "http://ai-proxy-service:8002"
  endpoints:
    embeddings:
      path: "/v1/embeddings"
      method: "POST"
      request_schema: "OpenAI Embeddings"
    
    rag_index:
      path: "/v1/rag/index"
      method: "POST"
      request_schema: "RAGIndexRequest"
```

#### Day 4-5: Data Migration Strategy
```sql
-- Design data migration scripts
-- Example: AI Chat Session migration

-- Phase 1: Dual-write to both systems
CREATE TRIGGER ai_chat_session_sync 
AFTER INSERT ON `tabAI Chat Session`
FOR EACH ROW
BEGIN
  -- Sync to new system via API call
  -- Keep old system as primary
END;

-- Phase 2: Switch primary to new system
-- Phase 3: Read from new system only  
-- Phase 4: Drop old tables
```

**Phase 0 Deliverables:**
- [ ] Complete coupling analysis report
- [ ] API contract specifications
- [ ] Data migration strategy
- [ ] Frontend integration plan
- [ ] Risk assessment document

---

## Phase 1: Parallel Architecture

**Duration:** 6 weeks  
**Goal:** Build new system alongside current one

### Week 3-4: New Frappe App Creation

#### Week 3: App Structure & Core Setup

**Day 1: Create New App**
```bash
# Create the new standalone app
cd frappe-bench
bench new-app lms_ai_assistant

# Configure app metadata
cat > apps/lms_ai_assistant/lms_ai_assistant/hooks.py << 'EOF'
from . import __version__ as app_version

app_name = "lms_ai_assistant"
app_title = "LMS AI Assistant"
app_publisher = "Your Company"
app_description = "Standalone AI Assistant for LMS"
app_license = "MIT"

# Minimal hooks - avoid coupling to LMS
fixtures = ["AI Assistant Config", "AI Prompt Preset"]
EOF
```

**Day 2-3: DocType Migration**
```bash
# Copy and modify all AI DocTypes
mkdir -p apps/lms_ai_assistant/lms_ai_assistant/doctype/

# List of DocTypes to migrate:
AI_DOCTYPES=(
    "ai_assistant_config"
    "ai_chat_session" 
    "ai_chat_message"
    "ai_external_source"
    "ai_faq_draft"
    "ai_faq_item"
    "ai_guardrail_event"
    "ai_knowledge_chunk"
    "ai_knowledge_index_run"
    "ai_lesson_draft"
    "ai_prompt_preset"
    "ai_proxy_log"
)

for doctype in "${AI_DOCTYPES[@]}"; do
    cp -r lms/lms/doctype/$doctype apps/lms_ai_assistant/lms_ai_assistant/doctype/
    # Update imports and references in copied files
done
```

**Day 4-5: API Layer Foundation**
```python
# apps/lms_ai_assistant/lms_ai_assistant/api.py
import frappe
import requests
from frappe import _

@frappe.whitelist()
def chat_completion(course, chapter, lesson, messages):
    """New standalone chat endpoint - calls AI Proxy service"""
    config = get_assistant_config(course)
    
    if not config.get("enabled"):
        frappe.throw(_("AI Assistant disabled for this course"))
    
    # Call external AI Proxy service
    proxy_url = config.get("proxy_url", "http://ai-proxy:8002")
    
    payload = {
        "course": course,
        "chapter": chapter,  
        "lesson": lesson,
        "messages": messages,
        "config": config
    }
    
    try:
        response = requests.post(f"{proxy_url}/v1/chat/completions", 
                               json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        frappe.log_error(f"AI Proxy error: {e}")
        return {"error": "AI service temporarily unavailable"}

def get_assistant_config(course):
    """Get effective AI config (global + course overrides)"""
    # Implementation matches current logic but in new app
    pass
```

#### Week 4: Core Logic Migration

**Day 1-2: AI Utils Migration**
```python
# apps/lms_ai_assistant/lms_ai_assistant/ai_utils.py
# Copy and adapt lms/lms/ai_utils.py

def draft_assistant_reply(course_context, lesson_context, messages):
    """Heuristic reply generation - now in standalone app"""
    # Copy current implementation
    pass

def determine_effective_assistant_config(course, lesson=None):
    """Config resolution - adapted for new app"""
    # Copy current implementation but update DocType references
    pass
```

**Day 3-4: RAG System Migration**  
```python
# apps/lms_ai_assistant/lms_ai_assistant/ai_rag.py
# Copy and adapt lms/lms/ai_rag.py

def chunk_lesson(lesson_name):
    """Lesson chunking - now calls LMS via API"""
    # Get lesson data via LMS API instead of direct DB access
    lesson_data = get_lesson_from_lms_api(lesson_name)
    # Rest of implementation stays the same
    pass

def get_lesson_from_lms_api(lesson_name):
    """Fetch lesson data from LMS via API"""
    lms_url = frappe.conf.get("lms_api_url", "http://lms:8000")
    response = requests.get(f"{lms_url}/api/method/lms.api.get_lesson", 
                          params={"lesson": lesson_name})
    return response.json()
```

**Day 5: Validation & Testing**
```python
# Test new app installation
bench --site lms.localhost install-app lms_ai_assistant

# Verify DocTypes created
bench --site lms.localhost console
>>> frappe.get_meta("AI Assistant Config")  # Should work

# Test basic API endpoints
curl -X POST http://localhost:8000/api/method/lms_ai_assistant.api.chat_completion \
  -H "Content-Type: application/json" \
  -d '{"course": "test", "lesson": "test", "messages": []}'
```

### Week 5-6: AI Proxy Service

#### Week 5: FastAPI Service Foundation

**Day 1: Project Structure**
```bash
# Create AI Proxy service
mkdir -p ai-proxy-service
cd ai-proxy-service

cat > requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
openai==1.3.0
requests==2.31.0
qdrant-client==1.6.0
python-multipart==0.0.6
asyncio==3.4.3
asyncpg==0.29.0
redis==5.0.1
EOF

# Initialize FastAPI app
cat > main.py << 'EOF'
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(title="LMS AI Proxy", version="1.0.0")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-proxy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
EOF
```

**Day 2-3: OpenAI-Compatible Endpoints**
```python
# ai-proxy-service/routers/chat.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import openai
import os

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gpt-3.5-turbo"
    stream: Optional[bool] = False
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7
    # LMS-specific context
    course: Optional[str] = None
    chapter: Optional[str] = None
    lesson: Optional[str] = None

@router.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """OpenAI-compatible chat completions with LMS context"""
    
    # Add LMS context to system prompt if available
    if request.course and request.lesson:
        context_prompt = build_lesson_context(request.course, request.lesson)
        request.messages.insert(0, ChatMessage(
            role="system", 
            content=context_prompt
        ))
    
    # Route to appropriate provider
    provider = get_provider_config(request.model)
    
    if provider["type"] == "openai":
        return await call_openai_api(request)
    elif provider["type"] == "azure":
        return await call_azure_api(request)
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")

def build_lesson_context(course: str, lesson: str) -> str:
    """Build context prompt from LMS lesson data"""
    # Fetch lesson content from LMS API
    lesson_data = fetch_lesson_from_lms(lesson)
    
    context = f"""You are an AI tutor for the course '{course}', specifically helping with lesson '{lesson}'.

Lesson Content Summary:
{lesson_data.get('body', '')[:500]}...

Learning Objectives:
{lesson_data.get('learning_objectives', 'Not specified')}

Please provide helpful, context-aware responses based on this lesson content."""
    
    return context
```

**Day 4-5: RAG Integration**
```python
# ai-proxy-service/services/rag.py
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
import numpy as np

class RAGService:
    def __init__(self):
        self.qdrant = QdrantClient(url="http://qdrant:6333")
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
        
    async def retrieve_context(self, query: str, course: str, lesson: str, top_k: int = 5):
        """Retrieve relevant context for query"""
        
        # Encode query
        query_vector = self.encoder.encode(query).tolist()
        
        # Search in course/lesson scope
        search_filter = {
            "must": [
                {"key": "course", "match": {"value": course}},
                {"key": "lesson", "match": {"value": lesson}}
            ]
        }
        
        results = self.qdrant.search(
            collection_name="lesson_chunks",
            query_vector=query_vector,
            query_filter=search_filter,
            limit=top_k
        )
        
        # Format results
        contexts = []
        for result in results:
            contexts.append({
                "content": result.payload["text"],
                "source": result.payload["source"],
                "score": result.score
            })
            
        return contexts
        
    async def index_lesson_content(self, course: str, lesson: str, content: str):
        """Index lesson content for RAG"""
        
        # Chunk content
        chunks = self.chunk_content(content)
        
        # Encode chunks
        vectors = self.encoder.encode([chunk["text"] for chunk in chunks])
        
        # Store in Qdrant
        points = []
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            points.append({
                "id": f"{course}_{lesson}_{i}",
                "vector": vector.tolist(),
                "payload": {
                    "course": course,
                    "lesson": lesson,
                    "text": chunk["text"],
                    "source": chunk["source"]
                }
            })
            
        self.qdrant.upsert(
            collection_name="lesson_chunks",
            points=points
        )
```

#### Week 6: Service Integration & Testing

**Day 1-2: Docker Configuration**
```yaml
# ai-proxy-service/docker-compose.yml
version: '3.8'

services:
  ai-proxy:
    build: .
    ports:
      - "8002:8002"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - QDRANT_URL=http://qdrant:6333
      - LMS_API_URL=http://lms:8000
    depends_on:
      - qdrant
      
  qdrant:
    image: qdrant/qdrant:v1.7.0
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
      
volumes:
  qdrant_data:
```

**Day 3-4: Integration Testing**
```python
# Test AI Proxy endpoints
import requests
import json

def test_chat_completion():
    url = "http://localhost:8002/v1/chat/completions"
    payload = {
        "messages": [{"role": "user", "content": "Explain this lesson"}],
        "course": "python-basics",
        "lesson": "variables-introduction",
        "model": "gpt-3.5-turbo"
    }
    
    response = requests.post(url, json=payload)
    assert response.status_code == 200
    assert "choices" in response.json()

def test_rag_indexing():
    url = "http://localhost:8002/v1/rag/index"
    payload = {
        "course": "python-basics",
        "lesson": "variables-introduction", 
        "content": "Variables in Python are containers for storing data values..."
    }
    
    response = requests.post(url, json=payload)
    assert response.status_code == 200
```

**Day 5: Documentation & Deployment**
```bash
# Create comprehensive API documentation
curl -X GET http://localhost:8002/docs > api_documentation.html

# Test deployment with Docker
docker-compose up -d

# Verify all services healthy
curl http://localhost:8002/health
# Should return: {"status": "healthy", "service": "ai-proxy"}
```

**Phase 1 Deliverables:**
- [ ] `lms_ai_assistant` Frappe app with all DocTypes migrated
- [ ] AI Proxy service with OpenAI-compatible endpoints
- [ ] RAG service with vector storage
- [ ] Docker deployment configuration
- [ ] API documentation and integration tests
- [ ] Both systems running in parallel

---

## Phase 2: Incremental Migration

**Duration:** 6 weeks  
**Goal:** Gradually replace current system with new architecture

### Week 7-8: Feature Flag Implementation

#### Week 7: LMS Integration Layer

**Day 1-2: Feature Flag System**
```python
# Add to lms/lms/api.py - MINIMAL changes to current system
import frappe
import requests

def get_ai_service_config():
    """Get AI service configuration"""
    return {
        "use_standalone_ai": frappe.db.get_single_value("LMS Settings", "use_standalone_ai"),
        "ai_assistant_url": frappe.db.get_single_value("LMS Settings", "ai_assistant_url") or "http://ai-assistant:8001",
        "ai_proxy_url": frappe.db.get_single_value("LMS Settings", "ai_proxy_url") or "http://ai-proxy:8002"
    }

@frappe.whitelist()
def chatbot_reply(course, chapter, lesson, messages):
    """Enhanced to support both old and new systems"""
    config = get_ai_service_config()
    
    if config["use_standalone_ai"]:
        # Route to new standalone system
        return call_standalone_ai_assistant(course, chapter, lesson, messages, config)
    else:
        # Keep current implementation as fallback
        return call_current_ai_system(course, chapter, lesson, messages)

def call_standalone_ai_assistant(course, chapter, lesson, messages, config):
    """Call new AI Assistant service"""
    try:
        url = f"{config['ai_assistant_url']}/api/v1/chat/completions"
        payload = {
            "course": course,
            "chapter": chapter,
            "lesson": lesson, 
            "messages": messages
        }
        
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
        
    except Exception as e:
        frappe.log_error(f"Standalone AI service error: {e}")
        # Fallback to current system
        return call_current_ai_system(course, chapter, lesson, messages)

def call_current_ai_system(course, chapter, lesson, messages):
    """Current implementation - unchanged"""
    # Keep existing implementation exactly as is
    from lms.lms.ai_utils import draft_assistant_reply
    # ... rest of current implementation
```

**Day 3-4: LMS Settings Extension**
```json
// Add new fields to LMS Settings DocType
{
  "fieldname": "use_standalone_ai",
  "fieldtype": "Check", 
  "label": "Use Standalone AI Assistant",
  "default": 0,
  "description": "Enable to use the new standalone AI Assistant service"
},
{
  "fieldname": "ai_assistant_url",
  "fieldtype": "Data",
  "label": "AI Assistant Service URL",
  "default": "http://ai-assistant:8001",
  "depends_on": "use_standalone_ai"
},
{
  "fieldname": "ai_proxy_url", 
  "fieldtype": "Data",
  "label": "AI Proxy Service URL",
  "default": "http://ai-proxy:8002",
  "depends_on": "use_standalone_ai"
}
```

**Day 5: Testing Both Systems**
```python
# Test script to validate both systems work
def test_dual_system():
    # Test current system
    frappe.db.set_single_value("LMS Settings", "use_standalone_ai", 0)
    old_response = frappe.call("lms.lms.api.chatbot_reply", 
                              course="test", lesson="test", messages=[])
    
    # Test new system  
    frappe.db.set_single_value("LMS Settings", "use_standalone_ai", 1)
    new_response = frappe.call("lms.lms.api.chatbot_reply",
                              course="test", lesson="test", messages=[])
    
    # Both should work without errors
    assert old_response.get("reply")
    assert new_response.get("reply") or new_response.get("error")
```

#### Week 8: Data Synchronization

**Day 1-3: Dual-Write Implementation**
```python
# Ensure data consistency between old and new systems
class AIChatSessionSync:
    @staticmethod
    def create_session(course, lesson, user):
        """Create session in both systems"""
        
        # Create in current system (primary)
        old_session = frappe.get_doc({
            "doctype": "AI Chat Session",
            "course": course,
            "lesson": lesson, 
            "user": user
        }).insert()
        
        # Sync to new system (secondary)
        try:
            new_session_data = {
                "course": course,
                "lesson": lesson,
                "user": user,
                "old_session_id": old_session.name
            }
            
            requests.post(
                f"{get_ai_assistant_url()}/api/v1/sessions",
                json=new_session_data
            )
        except Exception as e:
            frappe.log_error(f"Session sync failed: {e}")
            
        return old_session
```

**Day 4-5: Migration Scripts**
```python
# Data migration utilities
def migrate_ai_data_to_standalone():
    """Migrate existing AI data to new system"""
    
    # Get all AI Chat Sessions
    sessions = frappe.get_all("AI Chat Session", fields=["*"])
    
    for session in sessions:
        # Get related messages
        messages = frappe.get_all("AI Chat Message", 
                                filters={"session": session.name},
                                fields=["*"])
        
        # Sync to new system
        sync_session_to_standalone(session, messages)

def sync_session_to_standalone(session, messages):
    """Sync single session with messages to new system"""
    url = f"{get_ai_assistant_url()}/api/v1/sessions/migrate"
    
    payload = {
        "session": session,
        "messages": messages
    }
    
    response = requests.post(url, json=payload)
    if response.status_code != 200:
        frappe.log_error(f"Migration failed for session {session.name}")
```

### Week 9-10: Frontend Migration

#### Week 9: Component Abstraction

**Day 1-2: Create AI Service Layer**
```javascript
// frontend/src/services/aiService.js
class AIService {
  constructor() {
    this.useStandalone = this.getConfig('use_standalone_ai');
    this.assistantUrl = this.getConfig('ai_assistant_url');
  }

  async sendMessage(course, lesson, messages) {
    if (this.useStandalone) {
      return this.callStandaloneService(course, lesson, messages);
    } else {
      return this.callCurrentService(course, lesson, messages);
    }
  }

  async callStandaloneService(course, lesson, messages) {
    const response = await fetch(`${this.assistantUrl}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({course, lesson, messages})
    });
    return response.json();
  }

  async callCurrentService(course, lesson, messages) {
    // Keep existing implementation
    const response = await fetch('/api/method/lms.lms.api.chatbot_reply', {
      method: 'POST', 
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({course, lesson, messages})
    });
    return response.json();
  }

  getConfig(key) {
    // Get config from LMS Settings or environment
    return window.lmsConfig?.[key] || false;
  }
}

export default new AIService();
```

**Day 3-4: Update ChatbotPanel**
```vue
<!-- frontend/src/components/ChatbotPanel.vue -->
<template>
  <!-- Keep existing UI exactly the same -->
  <div class="chatbot-panel">
    <!-- ... existing UI components ... -->
  </div>
</template>

<script>
import AIService from '@/services/aiService'

export default {
  name: 'ChatbotPanel',
  // ... existing props and data ...
  
  methods: {
    async sendMessage() {
      try {
        // Replace direct API call with service abstraction
        const response = await AIService.sendMessage(
          this.course,
          this.lesson, 
          this.messages
        );
        
        // Rest of the logic stays the same
        this.handleResponse(response);
        
      } catch (error) {
        console.error('Chat error:', error);
        this.showErrorMessage();
      }
    },
    
    // ... rest of existing methods unchanged ...
  }
}
</script>
```

**Day 5: Frontend Testing**
```javascript
// Test both frontend implementations
describe('ChatbotPanel', () => {
  it('works with current system', async () => {
    window.lmsConfig = {use_standalone_ai: false};
    const panel = mount(ChatbotPanel, {props: {course: 'test', lesson: 'test'}});
    await panel.vm.sendMessage();
    // Should call current API
  });

  it('works with standalone system', async () => {
    window.lmsConfig = {use_standalone_ai: true, ai_assistant_url: 'http://localhost:8001'};
    const panel = mount(ChatbotPanel, {props: {course: 'test', lesson: 'test'}});
    await panel.vm.sendMessage();
    // Should call standalone API
  });
});
```

#### Week 10: Background Job Migration

**Day 1-3: Scheduler Abstraction**
```python
# Modify hooks.py to support both systems
scheduler_events = {
    "hourly": [
        "lms.lms.api.check_proxy_alerts_wrapper",  # New wrapper function
    ],
    "daily": [
        "lms.lms.ai_rag.backfill_embeddings_wrapper",  # New wrapper function
    ],
}

# New wrapper functions in lms/lms/api.py
def check_proxy_alerts_wrapper():
    """Wrapper to route to appropriate system"""
    config = get_ai_service_config()
    
    if config["use_standalone_ai"]:
        # Call standalone system
        requests.post(f"{config['ai_assistant_url']}/api/v1/tasks/check-alerts")
    else:
        # Call current system
        from lms.lms.api import check_proxy_alerts
        check_proxy_alerts()

def backfill_embeddings_wrapper():
    """Wrapper to route to appropriate system"""
    config = get_ai_service_config()
    
    if config["use_standalone_ai"]:
        # Call standalone system
        requests.post(f"{config['ai_proxy_url']}/v1/tasks/backfill-embeddings")
    else:
        # Call current system
        from lms.lms.ai_rag import backfill_embeddings_daily
        backfill_embeddings_daily()
```

**Day 4-5: Background Job Testing**
```python
# Test background job routing
def test_scheduler_routing():
    # Test current system
    frappe.db.set_single_value("LMS Settings", "use_standalone_ai", 0)
    check_proxy_alerts_wrapper()  # Should call current implementation
    
    # Test standalone system  
    frappe.db.set_single_value("LMS Settings", "use_standalone_ai", 1)
    check_proxy_alerts_wrapper()  # Should call standalone service
```

### Week 11-12: Gradual Rollout

#### Week 11: Canary Deployment

**Day 1-2: User-Based Feature Flags**
```python
# Enable standalone AI for specific users first
def should_use_standalone_ai(user=None):
    """Determine if user should use standalone AI"""
    
    # Global setting
    global_enabled = frappe.db.get_single_value("LMS Settings", "use_standalone_ai")
    if not global_enabled:
        return False
    
    # User-specific rollout
    user = user or frappe.session.user
    rollout_percentage = frappe.db.get_single_value("LMS Settings", "ai_rollout_percentage") or 0
    
    # Use user hash for consistent experience
    import hashlib
    user_hash = int(hashlib.md5(user.encode()).hexdigest()[:8], 16)
    user_percentage = user_hash % 100
    
    return user_percentage < rollout_percentage

# Update API wrapper
@frappe.whitelist()
def chatbot_reply(course, chapter, lesson, messages):
    """Route based on user-specific feature flag"""
    if should_use_standalone_ai():
        return call_standalone_ai_assistant(course, chapter, lesson, messages)
    else:
        return call_current_ai_system(course, chapter, lesson, messages)
```

**Day 3-4: Monitoring & Metrics**
```python
# Add metrics collection for both systems
class AISystemMetrics:
    @staticmethod
    def log_request(system_type, endpoint, response_time, success):
        """Log metrics for monitoring"""
        frappe.get_doc({
            "doctype": "AI System Metrics",
            "system_type": system_type,  # "current" or "standalone"
            "endpoint": endpoint,
            "response_time": response_time,
            "success": success,
            "timestamp": frappe.utils.now()
        }).insert()
    
    @staticmethod
    def get_comparison_metrics(hours=24):
        """Compare system performance"""
        current_metrics = frappe.db.sql("""
            SELECT AVG(response_time), COUNT(*), SUM(success)/COUNT(*) as success_rate
            FROM `tabAI System Metrics`
            WHERE system_type = 'current' 
            AND timestamp > DATE_SUB(NOW(), INTERVAL %s HOUR)
        """, (hours,))
        
        standalone_metrics = frappe.db.sql("""
            SELECT AVG(response_time), COUNT(*), SUM(success)/COUNT(*) as success_rate  
            FROM `tabAI System Metrics`
            WHERE system_type = 'standalone'
            AND timestamp > DATE_SUB(NOW(), INTERVAL %s HOUR)  
        """, (hours,))
        
        return {
            "current": current_metrics[0],
            "standalone": standalone_metrics[0]
        }
```

**Day 5: Rollout Control**
```python
# Gradual percentage-based rollout
def gradual_rollout_schedule():
    """Schedule for gradual rollout"""
    return [
        {"week": 11, "percentage": 5},   # Week 11: 5% of users
        {"week": 12, "percentage": 20},  # Week 12: 20% of users  
        {"week": 13, "percentage": 50},  # Week 13: 50% of users
        {"week": 14, "percentage": 100}, # Week 14: 100% of users
    ]

# Script to update rollout percentage
def update_rollout_percentage(percentage):
    """Update rollout percentage with safety checks"""
    
    # Check system health before increasing rollout
    metrics = AISystemMetrics.get_comparison_metrics()
    standalone_success_rate = metrics["standalone"][2]
    
    if standalone_success_rate < 0.95:  # 95% success rate requirement
        frappe.log_error("Standalone system success rate too low, halting rollout")
        return False
    
    frappe.db.set_single_value("LMS Settings", "ai_rollout_percentage", percentage)
    frappe.log_error(f"AI rollout updated to {percentage}%")
    return True
```

#### Week 12: Performance Validation

**Day 1-2: Load Testing**
```python
# Load test both systems
import concurrent.futures
import time

def load_test_comparison():
    """Compare performance under load"""
    
    def test_current_system():
        start = time.time()
        response = frappe.call("lms.lms.api.chatbot_reply", 
                             course="test", lesson="test", messages=[])
        return time.time() - start
    
    def test_standalone_system():
        start = time.time()
        # Call via standalone service
        response = requests.post("http://ai-assistant:8001/api/v1/chat/completions",
                               json={"course": "test", "lesson": "test", "messages": []})
        return time.time() - start
    
    # Run concurrent tests
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        # Test current system
        current_futures = [executor.submit(test_current_system) for _ in range(100)]
        current_times = [f.result() for f in current_futures]
        
        # Test standalone system  
        standalone_futures = [executor.submit(test_standalone_system) for _ in range(100)]
        standalone_times = [f.result() for f in standalone_futures]
    
    # Compare results
    return {
        "current_avg": sum(current_times) / len(current_times),
        "standalone_avg": sum(standalone_times) / len(standalone_times),
        "current_p95": sorted(current_times)[95],
        "standalone_p95": sorted(standalone_times)[95]
    }
```

**Day 3-5: Error Handling & Fallbacks**
```python
# Robust error handling between systems
def call_standalone_ai_assistant_with_fallback(course, chapter, lesson, messages):
    """Call standalone with automatic fallback"""
    
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            # Try standalone system
            config = get_ai_service_config()
            url = f"{config['ai_assistant_url']}/api/v1/chat/completions"
            
            response = requests.post(url, json={
                "course": course,
                "chapter": chapter, 
                "lesson": lesson,
                "messages": messages
            }, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            frappe.log_error(f"Standalone AI attempt {attempt + 1} failed: {e}")
            
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
            else:
                # Final fallback to current system
                frappe.log_error("Falling back to current AI system")
                return call_current_ai_system(course, chapter, lesson, messages)
```

**Phase 2 Deliverables:**
- [ ] Feature flag system with gradual rollout capability
- [ ] Data synchronization between old and new systems
- [ ] Frontend abstraction layer supporting both systems  
- [ ] Background job routing and migration
- [ ] Performance monitoring and comparison metrics
- [ ] Automated fallback mechanisms
- [ ] Load testing results showing performance parity

---

## Phase 3: Complete Extraction

**Duration:** 2 weeks  
**Goal:** Remove old AI system entirely

### Week 13: System Switchover

#### Day 1-2: Final Migration Validation
```bash
# Comprehensive validation script
#!/bin/bash

echo "Starting final migration validation..."

# 1. Verify all users on standalone system
ROLLOUT_PERCENTAGE=$(frappe --site lms.localhost console --quiet << 'EOF'
import frappe
print(frappe.db.get_single_value("LMS Settings", "ai_rollout_percentage"))
EOF
)

if [ "$ROLLOUT_PERCENTAGE" != "100" ]; then
    echo "ERROR: Rollout not at 100%. Current: $ROLLOUT_PERCENTAGE%"
    exit 1
fi

# 2. Data consistency check
frappe --site lms.localhost console --quiet << 'EOF'
import frappe
import requests

# Compare session counts
old_count = frappe.db.count("AI Chat Session")
response = requests.get("http://ai-assistant:8001/api/v1/sessions/count")
new_count = response.json()["count"]

if abs(old_count - new_count) > 10:  # Allow small variance
    print(f"ERROR: Session count mismatch. Old: {old_count}, New: {new_count}")
    exit(1)

print(f"✓ Session counts match: {old_count} ≈ {new_count}")
EOF

# 3. Feature parity test
python test_feature_parity.py

# 4. Performance validation
python load_test_final.py

echo "✓ All validation checks passed"
```

**Day 3-4: Remove AI Imports**
```python
# Update lms/lms/api.py - remove all AI imports
# BEFORE (current):
from lms.lms.ai_utils import (
    draft_assistant_reply,
    build_openai_chat_payload, 
    call_ai_proxy,
    # ... more imports
)

# AFTER (cleaned):
# Remove all AI-related imports
# Keep only the routing functions

@frappe.whitelist()
def chatbot_reply(course, chapter, lesson, messages):
    """Clean implementation - only calls standalone service"""
    config = get_ai_service_config()
    
    if not config.get("use_standalone_ai"):
        frappe.throw(_("AI Assistant requires standalone service"))
    
    return call_standalone_ai_assistant(course, chapter, lesson, messages, config)

# Remove all old AI functions:
# - draft_assistant_reply() ❌ DELETED
# - build_openai_chat_payload() ❌ DELETED  
# - call_ai_proxy() ❌ DELETED
# - stream_ai_proxy() ❌ DELETED
# ... etc
```

**Day 5: Update Hooks**
```python
# Update lms/hooks.py - remove AI scheduler entries
scheduler_events = {
    "hourly": [
        "lms.lms.doctype.lms_certificate_request.lms_certificate_request.schedule_evals",
        "lms.lms.api.update_course_statistics",
        "lms.lms.doctype.lms_certificate_request.lms_certificate_request.mark_eval_as_completed",
        "lms.lms.doctype.lms_live_class.lms_live_class.update_attendance",
        # ❌ REMOVED: "lms.lms.api.check_proxy_alerts",
    ],
    "daily": [
        "lms.job.doctype.job_opportunity.job_opportunity.update_job_openings",
        "lms.lms.doctype.lms_payment.lms_payment.send_payment_reminder",
        "lms.lms.doctype.lms_batch.lms_batch.send_batch_start_reminder",
        "lms.lms.doctype.lms_live_class.lms_live_class.send_live_class_reminder",
        # ❌ REMOVED: "lms.lms.ai_rag.backfill_embeddings_daily",
    ],
}

# Note: AI scheduler tasks now run in AI Proxy service
```

### Week 14: File Cleanup

#### Day 1-3: Delete AI Files
```bash
#!/bin/bash

echo "Starting AI file cleanup..."

# List of files to delete (all the ones we identified earlier)
AI_FILES_TO_DELETE=(
    "lms/lms/ai_rag.py"
    "lms/lms/ai_utils.py"
    "lms/lms/doctype/ai_assistant_config/"
    "lms/lms/doctype/ai_chat_message/"
    "lms/lms/doctype/ai_chat_session/"
    "lms/lms/doctype/ai_external_source/"
    "lms/lms/doctype/ai_faq_draft/"
    "lms/lms/doctype/ai_faq_item/"
    "lms/lms/doctype/ai_guardrail_event/"
    "lms/lms/doctype/ai_knowledge_chunk/"
    "lms/lms/doctype/ai_knowledge_index_run/"
    "lms/lms/doctype/ai_lesson_draft/"
    "lms/lms/doctype/ai_prompt_preset/"
    "lms/lms/doctype/ai_proxy_log/"
    "lms/lms/report/ai_chat_lesson_detail/"
    "lms/lms/report/ai_chat_usage/"
    "lms/lms/report/ai_embeddings_coverage/"
    "lms/lms/report/ai_external_sources_errors/"
    "lms/lms/report/ai_external_sources_summary/"
    "lms/lms/report/ai_guardrail_events/"
    "lms/lms/report/ai_proxy_errors_by_status/"
    "lms/lms/report/ai_proxy_summary/"
)

# Backup before deletion
BACKUP_DIR="./ai_files_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

for file in "${AI_FILES_TO_DELETE[@]}"; do
    if [ -e "$file" ]; then
        echo "Backing up: $file"
        cp -r "$file" "$BACKUP_DIR/"
        
        echo "Deleting: $file"
        rm -rf "$file"
    fi
done

# Clean up frontend references
find frontend/ -name "*.vue" -exec sed -i '/ai_/d; /assistant/d; /chat.*ai/d' {} \;

echo "✓ File cleanup completed. Backup saved to: $BACKUP_DIR"
```

**Day 4: Database Cleanup**
```python
# Remove AI DocTypes from database
def cleanup_ai_doctypes():
    """Remove AI DocTypes from database"""
    
    ai_doctypes = [
        "AI Assistant Config",
        "AI Chat Session", 
        "AI Chat Message",
        "AI External Source",
        "AI FAQ Draft",
        "AI FAQ Item", 
        "AI Guardrail Event",
        "AI Knowledge Chunk",
        "AI Knowledge Index Run",
        "AI Lesson Draft",
        "AI Prompt Preset",
        "AI Proxy Log"
    ]
    
    for doctype in ai_doctypes:
        try:
            # Delete all records first
            frappe.db.sql(f"DELETE FROM `tab{doctype}`")
            
            # Delete DocType definition
            if frappe.db.exists("DocType", doctype):
                frappe.delete_doc("DocType", doctype, force=True)
                print(f"✓ Deleted DocType: {doctype}")
                
        except Exception as e:
            print(f"Error deleting {doctype}: {e}")
    
    # Remove AI fields from LMS Settings
    lms_settings_meta = frappe.get_meta("LMS Settings")
    ai_fields = [f for f in lms_settings_meta.fields if 'ai' in f.fieldname.lower()]
    
    for field in ai_fields:
        # This would require a migration to remove fields properly
        print(f"AI field to remove from LMS Settings: {field.fieldname}")

# Run cleanup
cleanup_ai_doctypes()
```

**Day 5: Final Validation**
```python
# Comprehensive final validation
def final_validation():
    """Ensure clean separation achieved"""
    
    print("Running final validation...")
    
    # 1. Check no AI imports remain
    ai_imports = []
    for root, dirs, files in os.walk("lms/"):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    content = f.read()
                    if re.search(r'from lms\.lms\.ai_|import.*ai_', content):
                        ai_imports.append(filepath)
    
    if ai_imports:
        print(f"❌ AI imports still found in: {ai_imports}")
        return False
    
    # 2. Check AI files deleted
    ai_file_patterns = ["**/ai_*.py", "**/ai_*", "**/AI*"]
    remaining_files = []
    for pattern in ai_file_patterns:
        remaining_files.extend(glob.glob(f"lms/**/{pattern}", recursive=True))
    
    if remaining_files:
        print(f"❌ AI files still present: {remaining_files}")
        return False
    
    # 3. Test LMS core functionality without AI
    try:
        # Test course creation
        course = frappe.get_doc({
            "doctype": "LMS Course",
            "title": "Test Course - No AI",
            "name": "test-course-no-ai"
        })
        course.insert()
        
        # Test lesson creation
        lesson = frappe.get_doc({
            "doctype": "Course Lesson", 
            "title": "Test Lesson - No AI",
            "course": course.name
        })
        lesson.insert()
        
        print("✓ Core LMS functionality working")
        
    except Exception as e:
        print(f"❌ Core LMS functionality broken: {e}")
        return False
    
    # 4. Verify standalone AI works
    try:
        response = requests.get("http://ai-assistant:8001/health")
        if response.status_code == 200:
            print("✓ Standalone AI Assistant service healthy")
        else:
            print(f"❌ AI Assistant service unhealthy: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Cannot reach AI Assistant service: {e}")
        return False
    
    print("✅ All final validation checks passed!")
    return True

# Run final validation
final_validation()
```

**Phase 3 Deliverables:**
- [ ] Complete removal of AI code from LMS core
- [ ] All AI functionality moved to standalone services
- [ ] Database cleanup with DocType removal
- [ ] Core LMS functionality validated without AI dependencies
- [ ] Standalone AI services fully operational
- [ ] Clean git history with proper commit messages

---

## Phase 4: Cleanup & Optimization

**Duration:** 2 weeks  
**Goal:** Optimize new architecture and document

### Week 15: Performance Optimization

#### Day 1-2: AI Assistant Service Optimization
```python
# Optimize AI Assistant service performance
# ai-assistant-service/performance_optimizations.py

# 1. Connection pooling
import asyncio
import aiohttp
from aiohttp import ClientSession

class OptimizedAIAssistant:
    def __init__(self):
        self.session = None
        self.lms_connector = LMSConnector()
        
    async def __aenter__(self):
        connector = aiohttp.TCPConnector(
            limit=100,  # Total connection pool size
            limit_per_host=30,  # Connections per host
            keepalive_timeout=300,  # Keep connections alive for 5 minutes
            enable_cleanup_closed=True
        )
        
        self.session = ClientSession(
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    # 2. Caching layer
    @lru_cache(maxsize=1000)
    def get_lesson_context(self, course: str, lesson: str) -> str:
        """Cache lesson context to avoid repeated LMS API calls"""
        return self.lms_connector.fetch_lesson_content(course, lesson)
    
    # 3. Async processing
    async def process_chat_request(self, request: ChatRequest):
        """Async chat processing with parallel operations"""
        
        # Run context gathering and config resolution in parallel
        context_task = asyncio.create_task(
            self.get_lesson_context_async(request.course, request.lesson)
        )
        config_task = asyncio.create_task(
            self.get_effective_config_async(request.course)
        )
        
        # Wait for both to complete
        context, config = await asyncio.gather(context_task, config_task)
        
        # Process chat with gathered data
        return await self.generate_response(request, context, config)
```

**Day 3-4: AI Proxy Service Optimization**
```python
# Optimize AI Proxy service
# ai-proxy-service/optimizations.py

# 1. Batch embeddings processing
class BatchEmbeddingsProcessor:
    def __init__(self, batch_size=32, max_wait_time=2.0):
        self.batch_size = batch_size
        self.max_wait_time = max_wait_time
        self.pending_requests = []
        self.batch_timer = None
        
    async def add_request(self, text: str, callback):
        """Add embedding request to batch"""
        self.pending_requests.append({"text": text, "callback": callback})
        
        if len(self.pending_requests) >= self.batch_size:
            await self.process_batch()
        elif self.batch_timer is None:
            self.batch_timer = asyncio.create_task(self.wait_and_process())
    
    async def process_batch(self):
        """Process current batch of embedding requests"""
        if not self.pending_requests:
            return
            
        texts = [req["text"] for req in self.pending_requests]
        callbacks = [req["callback"] for req in self.pending_requests]
        
        # Get embeddings for entire batch
        embeddings = await self.embedding_model.encode_batch(texts)
        
        # Call back with results
        for callback, embedding in zip(callbacks, embeddings):
            await callback(embedding)
        
        # Clear batch
        self.pending_requests.clear()
        if self.batch_timer:
            self.batch_timer.cancel()
            self.batch_timer = None

# 2. Vector search optimization  
class OptimizedVectorSearch:
    def __init__(self):
        self.qdrant = QdrantClient(url="http://qdrant:6333")
        # Pre-compile search filters for common patterns
        self.filter_cache = {}
        
    def get_optimized_filter(self, course: str, lesson: str = None):
        """Get optimized search filter with caching"""
        cache_key = f"{course}:{lesson}"
        
        if cache_key not in self.filter_cache:
            filter_conditions = [
                {"key": "course", "match": {"value": course}}
            ]
            if lesson:
                filter_conditions.append(
                    {"key": "lesson", "match": {"value": lesson}}
                )
            
            self.filter_cache[cache_key] = {"must": filter_conditions}
        
        return self.filter_cache[cache_key]
    
    async def search_with_reranking(self, query_vector, course, lesson, top_k=20, final_k=5):
        """Two-stage search: fast retrieval + precise reranking"""
        
        # Stage 1: Fast approximate search with larger k
        initial_results = await self.qdrant.search(
            collection_name="lesson_chunks",
            query_vector=query_vector,
            query_filter=self.get_optimized_filter(course, lesson),
            limit=top_k,
            search_params={"hnsw_ef": 64}  # Lower precision for speed
        )
        
        # Stage 2: Rerank top results with precise scoring
        reranked_results = await self.rerank_results(
            query_vector, initial_results, final_k
        )
        
        return reranked_results
```

**Day 5: Monitoring & Metrics**
```python
# Add comprehensive monitoring
# monitoring/metrics_collector.py

from prometheus_client import Counter, Histogram, Gauge
import time

# Metrics definitions
chat_requests_total = Counter('ai_chat_requests_total', 'Total chat requests', ['service', 'course'])
chat_request_duration = Histogram('ai_chat_request_duration_seconds', 'Chat request duration', ['service'])
active_sessions = Gauge('ai_active_sessions', 'Number of active chat sessions')
embedding_batch_size = Histogram('ai_embedding_batch_size', 'Embedding batch sizes processed')

class MetricsCollector:
    @staticmethod
    def record_chat_request(service: str, course: str, duration: float):
        chat_requests_total.labels(service=service, course=course).inc()
        chat_request_duration.labels(service=service).observe(duration)
    
    @staticmethod  
    def record_embedding_batch(batch_size: int):
        embedding_batch_size.observe(batch_size)
    
    @staticmethod
    def update_active_sessions(count: int):
        active_sessions.set(count)

# Usage in services
class MonitoredAIService:
    async def chat_completion(self, request):
        start_time = time.time()
        
        try:
            result = await self.process_chat(request)
            return result
        finally:
            duration = time.time() - start_time
            MetricsCollector.record_chat_request(
                service="ai_assistant",
                course=request.course,
                duration=duration
            )
```

### Week 16: Documentation & Handoff

#### Day 1-2: Architecture Documentation
```markdown
# AI Assistant Standalone Architecture Documentation

## Overview
The AI Assistant has been successfully extracted from the monolithic Frappe LMS into a standalone, microservices-based architecture.

## Components

### 1. LMS AI Assistant (Frappe App)
- **Purpose**: Provides AI DocTypes and API endpoints within Frappe ecosystem
- **License**: MIT
- **Location**: `apps/lms_ai_assistant/`
- **Key Files**:
  - `api.py` - HTTP API endpoints
  - `hooks.py` - Frappe integration hooks
  - `doctype/` - AI-related DocTypes

### 2. AI Proxy Service
- **Purpose**: OpenAI-compatible API with provider routing and RAG
- **License**: MIT  
- **Location**: `ai-proxy-service/`
- **Tech Stack**: FastAPI, Qdrant, async Python
- **Key Features**:
  - Multiple LLM provider support
  - Vector search and embeddings
  - Rate limiting and authentication

### 3. Integration Layer
- **Purpose**: Minimal LMS core changes for service communication
- **Files Modified**: `lms/lms/api.py` (routing only)
- **Pattern**: HTTP API calls with fallback mechanisms

## Data Flow
```
User Request → LMS Frontend → LMS API Layer → AI Assistant Service → AI Proxy Service → LLM Provider
                                   ↓
                            Session Storage (AI Assistant)
                                   ↓  
                            Vector Storage (Qdrant)
```

## Deployment
- Docker Compose with separate containers
- Independent scaling per service
- Shared networks for inter-service communication

## Monitoring
- Prometheus metrics collection
- Service health checks
- Performance monitoring dashboards
```

**Day 3-4: Operations Runbook**
```markdown
# AI Assistant Operations Runbook

## Deployment

### Initial Setup
```bash
# 1. Deploy AI Proxy Service
cd ai-proxy-service
docker-compose up -d

# 2. Install AI Assistant App  
cd frappe-bench
bench get-app lms_ai_assistant ./apps/lms_ai_assistant
bench --site mysite.local install-app lms_ai_assistant

# 3. Configure LMS Settings
# Set "Use Standalone AI Assistant" = true
# Set service URLs appropriately
```

### Monitoring

#### Health Checks
```bash
# Check AI Proxy Service
curl http://ai-proxy:8002/health

# Check AI Assistant Service  
curl http://ai-assistant:8001/health

# Check Qdrant Vector DB
curl http://qdrant:6333/health
```

#### Key Metrics to Monitor
- Chat response latency (target: < 2s p95)
- Error rates (target: < 1%)
- Active sessions count
- Vector search performance
- Embedding processing queue size

### Troubleshooting

#### Common Issues

**Issue**: "AI service temporarily unavailable"
**Cause**: AI Proxy service down or unreachable
**Solution**: 
1. Check service health: `docker logs ai-proxy`
2. Verify network connectivity
3. Restart service if needed: `docker-compose restart ai-proxy`

**Issue**: Slow response times
**Cause**: Vector search performance or LLM provider latency
**Solution**:
1. Check Qdrant performance metrics
2. Monitor LLM provider API latency
3. Consider adding more vector search workers

**Issue**: High memory usage
**Cause**: Embedding model loaded in memory or large vector index
**Solution**:
1. Monitor embedding service memory
2. Consider model quantization
3. Optimize vector index configuration

### Scaling

#### Horizontal Scaling
```yaml
# Scale AI Assistant service
ai-assistant:
  deploy:
    replicas: 3
    
# Scale AI Proxy service  
ai-proxy:
  deploy:
    replicas: 2
```

#### Performance Tuning
```python
# Optimize batch sizes
EMBEDDING_BATCH_SIZE = 32  # Tune based on GPU memory
RAG_TOP_K = 10           # Balance relevance vs speed
CACHE_TTL = 300          # Cache lesson context for 5 minutes
```
```

**Day 5: Knowledge Transfer**
```markdown
# Development Handoff Guide

## Code Structure

### Adding New AI Features
1. Add business logic to AI Assistant service
2. Add infrastructure logic to AI Proxy service  
3. Add minimal routing in LMS core (if needed)
4. Update API contracts and documentation

### Database Changes
- AI DocTypes live in `lms_ai_assistant` app
- Use standard Frappe migrations
- No changes needed in LMS core database

### Frontend Changes
- Modify components in `lms_ai_assistant` app
- Use existing service abstraction layer
- Test with both standalone and fallback modes

## Testing Strategy

### Unit Tests
```bash
# AI Assistant service tests
cd apps/lms_ai_assistant
python -m pytest tests/

# AI Proxy service tests  
cd ai-proxy-service
python -m pytest tests/
```

### Integration Tests
```bash
# End-to-end functionality
python test_ai_integration.py
```

### Load Tests
```bash
# Performance testing
python load_test_ai_services.py
```

## Security Considerations

### API Keys
- All LLM provider keys stored in AI Proxy service only
- No keys exposed to LMS frontend
- Use environment variables or secure key management

### Network Security
- Services communicate via internal Docker networks
- Only necessary ports exposed externally
- Consider adding API authentication between services

### Data Privacy  
- Chat logs stored with user consent
- PII filtering in place for external LLM calls
- GDPR compliance for user data export/deletion

## Future Enhancements

### Planned Features
- [ ] Multi-tenant support with data isolation
- [ ] Advanced RAG with reranking models
- [ ] Real-time collaborative chat sessions
- [ ] AI-powered content generation tools

### Architecture Evolution
- Consider Kubernetes deployment for production scale
- Add message queue for async processing
- Implement circuit breakers for resilience
- Add distributed tracing for debugging
```

**Phase 4 Deliverables:**
- [ ] Performance-optimized AI services
- [ ] Comprehensive monitoring and metrics
- [ ] Complete architecture documentation
- [ ] Operations runbook with troubleshooting guide
- [ ] Development handoff documentation
- [ ] Load testing results and capacity planning

---

## Risk Management

### High-Risk Scenarios

#### 1. Data Loss During Migration
**Risk**: Chat history or configuration data lost during extraction
**Mitigation**:
- Complete backup before each phase
- Dual-write to both systems during transition
- Automated data consistency validation
- Rollback procedures for each phase

#### 2. Service Dependencies Break
**Risk**: LMS core functionality breaks due to missing AI dependencies  
**Mitigation**:
- Gradual extraction with feature flags
- Comprehensive integration testing
- Fallback mechanisms for all AI features
- Core LMS functionality isolation

#### 3. Performance Degradation  
**Risk**: New architecture performs worse than current system
**Mitigation**:
- Load testing at each phase
- Performance monitoring and comparison
- Optimization before full rollout
- Rollback capability if performance targets not met

#### 4. User Experience Impact
**Risk**: Users notice functionality changes or degradation
**Mitigation**:
- Maintain identical frontend experience
- A/B testing during rollout phases
- User feedback collection
- Quick rollback procedures

### Rollback Procedures

#### Phase 1 Rollback
```bash
# Simple rollback - new services built in parallel
docker-compose down  # Stop new services
# Current system continues unchanged
```

#### Phase 2 Rollback  
```bash
# Disable feature flag
frappe --site mysite.local console << 'EOF'
frappe.db.set_single_value("LMS Settings", "use_standalone_ai", 0)
EOF

# All traffic routes back to current system
```

#### Phase 3 Rollback
```bash
# Restore backed up AI files
cp -r ai_files_backup_*/. ./

# Reinstall backed up DocTypes
frappe --site mysite.local console << 'EOF'
# Restore DocType definitions from backup
EOF

# Re-enable AI imports in api.py
git checkout HEAD~1 lms/lms/api.py  # Or restore from backup
```

---

## Testing Strategy

### Automated Testing Pipeline

#### 1. Unit Tests
```python
# Test individual components in isolation
class TestAIAssistantAPI:
    def test_chat_completion_success(self):
        # Test successful chat completion
        pass
        
    def test_chat_completion_fallback(self):
        # Test fallback to current system
        pass
        
    def test_config_resolution(self):
        # Test global + course config merging
        pass

class TestAIProxyService:
    def test_openai_provider_routing(self):
        # Test OpenAI API routing
        pass
        
    def test_vector_search(self):
        # Test RAG vector search
        pass
        
    def test_rate_limiting(self):
        # Test rate limiting functionality
        pass
```

#### 2. Integration Tests  
```python
# Test service-to-service communication
class TestServiceIntegration:
    def test_lms_to_ai_assistant_flow(self):
        # Test complete request flow
        pass
        
    def test_ai_assistant_to_proxy_flow(self):
        # Test AI Assistant → AI Proxy communication
        pass
        
    def test_data_consistency(self):
        # Test data sync between old and new systems
        pass

class TestEndToEndFlow:
    def test_complete_chat_flow(self):
        # Test from frontend to LLM provider and back
        pass
        
    def test_rag_enhanced_responses(self):
        # Test RAG-enhanced chat responses
        pass
```

#### 3. Performance Tests
```python
# Load testing for capacity planning
class TestPerformance:
    def test_concurrent_chat_requests(self):
        # Test 100 concurrent chat requests
        pass
        
    def test_vector_search_performance(self):
        # Test vector search latency under load
        pass
        
    def test_embedding_batch_processing(self):
        # Test embedding processing throughput
        pass
```

#### 4. Chaos Testing
```python
# Test system resilience
class TestResilience:
    def test_ai_proxy_failure_fallback(self):
        # Test fallback when AI Proxy is down
        pass
        
    def test_vector_db_failure_handling(self):
        # Test graceful degradation when Qdrant is down
        pass
        
    def test_llm_provider_timeout(self):
        # Test handling of LLM provider timeouts
        pass
```

---

## Deployment Architecture

### Development Environment
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  lms:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEV_MODE=1
      - AI_ASSISTANT_URL=http://ai-assistant:8001
    depends_on:
      - ai-assistant
      
  ai-assistant:
    build: ./apps/lms_ai_assistant
    ports:
      - "8001:8001"
    environment:
      - AI_PROXY_URL=http://ai-proxy:8002
      - LMS_API_URL=http://lms:8000
    depends_on:
      - ai-proxy
      
  ai-proxy:
    build: ./ai-proxy-service
    ports:
      - "8002:8002"
    environment:
      - QDRANT_URL=http://qdrant:6333
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - qdrant
      
  qdrant:
    image: qdrant/qdrant:v1.7.0
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  qdrant_data:
```

### Production Environment  
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  lms:
    image: your-registry/lms:${VERSION}
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    environment:
      - AI_ASSISTANT_URL=http://ai-assistant:8001
    networks:
      - frontend
      - backend
      
  ai-assistant:
    image: your-registry/ai-assistant:${VERSION}  
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    environment:
      - AI_PROXY_URL=http://ai-proxy:8002
    networks:
      - backend
      
  ai-proxy:
    image: your-registry/ai-proxy:${VERSION}
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
    environment:
      - QDRANT_URL=http://qdrant:6333
    networks:
      - backend
      - ai-services
      
  qdrant:
    image: qdrant/qdrant:v1.7.0
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 8G
          cpus: '4.0'
    volumes:
      - qdrant_data:/qdrant/storage
    networks:
      - ai-services

networks:
  frontend:
  backend:
  ai-services:
    
volumes:
  qdrant_data:
    driver: local
```

---

## Success Metrics

### Technical Metrics

#### Performance
- **Chat Response Latency**: < 2s p95 (current: ~1.5s)
- **System Availability**: > 99.9% uptime
- **Error Rate**: < 1% of requests
- **Throughput**: Support 10x current load

#### Quality  
- **Feature Parity**: 100% of current AI features working
- **Data Consistency**: 99.99% between old and new systems
- **User Experience**: No degradation in frontend experience

### Business Metrics

#### Licensing Freedom
- **Legal Independence**: Complete separation from AGPL-3.0 obligations
- **Commercial Flexibility**: Ability to license AI components separately
- **Distribution Rights**: Freedom to distribute AI features under permissive license

#### Operational Benefits
- **Maintainability**: Reduced coupling between LMS and AI features
- **Scalability**: Independent scaling of AI components
- **Deployment Flexibility**: Ability to deploy AI features separately

### Validation Criteria

#### Phase Completion Criteria
Each phase must meet these criteria before proceeding:

1. **Functionality**: All existing features work identically
2. **Performance**: No degradation in response times or throughput
3. **Reliability**: Error rates remain within acceptable bounds
4. **Security**: No new vulnerabilities introduced
5. **Data Integrity**: No data loss or corruption

#### Final Success Criteria
Project completion requires:

1. **Complete Extraction**: Zero AI code remaining in LMS core
2. **Independent Operation**: AI services run completely independently 
3. **License Compliance**: Clear MIT licensing for all AI components
4. **Performance Targets**: All performance metrics within targets
5. **Documentation**: Complete operational and development documentation

---

## Timeline Summary

| Phase | Duration | Key Milestones | Risk Level |
|-------|----------|----------------|------------|
| **Phase 0** | 2 weeks | Architecture design, coupling analysis | Low |
| **Phase 1** | 6 weeks | Parallel architecture built and tested | Medium |
| **Phase 2** | 6 weeks | Gradual migration with feature flags | High |
| **Phase 3** | 2 weeks | Complete extraction and cleanup | Medium |
| **Phase 4** | 2 weeks | Optimization and documentation | Low |

**Total Duration**: 18 weeks (4.5 months)

---

## Next Steps

1. **Approve this roadmap** and timeline
2. **Assign team resources** for execution
3. **Set up project tracking** (GitHub issues, Jira, etc.)
4. **Begin Phase 0** with coupling analysis
5. **Establish monitoring** and success metrics
6. **Schedule regular reviews** (weekly during high-risk phases)

This roadmap provides a comprehensive, low-risk path to achieve licensing freedom while maintaining all current functionality. The gradual approach ensures we can validate each step and rollback if needed, while the parallel architecture allows us to build confidence in the new system before fully committing to it.
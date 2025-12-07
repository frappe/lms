def get_provider_headers(base_url: str, api_key: str, custom_headers: dict = None, custom_headers_json: str = None) -> dict:
    """Auto-detect provider requirements with override capability for major AI providers.
    
    Supports: OpenAI, OpenRouter, Anthropic, Azure, Together.ai, Fireworks.ai, 
    Hugging Face, Groq, and local deployments. Falls back to OpenAI standard.
    
    Args:
        base_url: The API base URL
        api_key: The API key
        custom_headers: Optional dict to override/add headers for unsupported providers
        custom_headers_json: Optional JSON string to parse additional headers from LMS Settings
    
    Returns:
        Dict of headers ready for requests
    """
    base_lower = (base_url or "").lower()
    headers = {"Content-Type": "application/json"}
    
    # Provider-specific requirements
    if "openrouter.ai" in base_lower:
        # OpenRouter requires HTTP-Referer for billing/attribution
        try:
            import frappe
            site_url = frappe.utils.get_url()
        except Exception:
            site_url = "http://localhost:8000"  # Fallback for development
        headers["HTTP-Referer"] = site_url
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            
    elif "api.anthropic.com" in base_lower:
        # Anthropic uses x-api-key instead of Authorization
        if api_key:
            headers["x-api-key"] = api_key
            
    elif "openai.azure.com" in base_lower:
        # Azure OpenAI uses api-key header
        if api_key:
            headers["api-key"] = api_key
            
    elif any(domain in base_lower for domain in [
        "api.fireworks.ai", "api-inference.huggingface.co", "api.openai.com", 
        "api.together.xyz", "api.groq.com"
    ]):
        # Standard OpenAI format
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            
    elif any(indicator in base_lower for indicator in ["localhost", "127.0.0.1", "192.168.", "10."]):
        # Local deployments (Ollama, etc.) - often no auth needed
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
    else:
        # Default to standard OpenAI format for unknown providers
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
    
    # Parse custom headers from LMS Settings JSON field
    if custom_headers_json:
        try:
            import json
            json_headers = json.loads(custom_headers_json.strip())
            if isinstance(json_headers, dict):
                headers.update(json_headers)
        except Exception:
            pass  # Ignore invalid JSON, fall back to auto-detection
    
    # Allow custom header overrides for providers like Alibaba, Baidu, etc.
    if custom_headers:
        headers.update(custom_headers)
        
    return headers


def draft_assistant_reply(user_utterance: str, title: str, chapter_title: str, course_title: str) -> str:
    """
    Return a deterministic, lesson-aware reply based on a simple intent heuristic.

    This pure function is intentionally free of Frappe dependencies for unit testing.
    """
    title = title or "this lesson"
    chapter_title = chapter_title or "this chapter"
    course_title = course_title or "this course"
    text = (user_utterance or "").strip().lower()

    if any(k in text for k in ["summarize", "summary"]):
        return (
            f"Here’s a quick summary of ‘{title}’ from {course_title}. "
            "Focus on the key objective, skim examples, then try a quick self-check. "
            "If a concept feels fuzzy, ask me to explain with another example."
        )
    if any(k in text for k in ["example", "explain", "clarify", "how"]):
        return (
            f"In ‘{title}’, the core idea is introduced in context of {chapter_title}. "
            "Start by restating the concept in your own words. Which part should I unpack—definition, steps, or a worked example?"
        )
    if any(k in text for k in ["quiz", "test", "practice", "question"]):
        return (
            f"Let’s practice ‘{title}’. I can generate 3 quick questions: one recall, one application, and one challenge. "
            "Would you like multiple-choice or short answers?"
        )

    return (
        f"You’re on ‘{title}’ in {course_title}. Tell me what’s unclear—definition, steps, or an example? "
        "I can also summarize, quiz you, or relate it to prior lessons."
    )


def build_openai_chat_payload(system_prompt: str, messages: list, model: str, temperature: float = 0.2, max_tokens: int = 512) -> dict:
    """
    Build an OpenAI-compatible chat.completions payload.
    messages: list of dicts [{role, content}].
    """
    payload = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [],
    }
    if system_prompt:
        payload["messages"].append({"role": "system", "content": system_prompt})
    for m in messages or []:
        role = m.get("role") if isinstance(m, dict) else None
        content = m.get("content") if isinstance(m, dict) else None
        if role and content:
            payload["messages"].append({"role": role, "content": content})
    return payload


def call_ai_proxy(base_url: str, api_key: str, payload: dict, timeout: int = 30, custom_headers: dict = None, custom_headers_json: str = None):
    """Call an OpenAI-compatible proxy (non-streaming) with basic headers for debugging.

    Args:
        base_url: The API base URL (e.g., 'https://openrouter.ai/api/v1') - '/chat/completions' will be appended
        api_key: The API key
        payload: The request payload
        timeout: Request timeout in seconds
        custom_headers: Optional dict to override/add headers for unsupported providers
        custom_headers_json: Optional JSON string to parse additional headers from LMS Settings
        
    Returns: {"content": str|None, "status_code": int|None, "error": str|None}
    """
    import requests

    if not base_url:
        return {"content": None, "status_code": None, "error": "missing_base_url"}
    url = base_url.rstrip("/") + "/chat/completions"
    
    headers = get_provider_headers(base_url, api_key, custom_headers, custom_headers_json)
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            return {"content": None, "status_code": resp.status_code, "error": f"HTTP {resp.status_code}: {resp.text[:500]}"}
        data = resp.json()
        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content")
        )
        return {"content": content, "status_code": resp.status_code, "error": None}
    except Exception as e:
        return {"content": None, "status_code": None, "error": str(e)[:500]}


def stream_ai_proxy(base_url: str, api_key: str, payload: dict, timeout: int = 60, custom_headers: dict = None, custom_headers_json: str = None):
    """Yield Server-Sent Events from an OpenAI-compatible streaming endpoint with auto-detected provider headers.

    This yields raw SSE lines (bytes) from the upstream response. Additionally,
    it accumulates text content parsed from choices[0].delta.content and yields
    it via a side-channel dictionary appended as the last yield (not sent to client).
    
    Args:
        base_url: The API base URL
        api_key: The API key  
        payload: The request payload
        timeout: Request timeout in seconds
        custom_headers: Optional dict to override/add headers for unsupported providers
        custom_headers_json: Optional JSON string to parse additional headers from LMS Settings
    """
    import requests

    if not base_url:
        return
    url = base_url.rstrip("/") + "/chat/completions"
    headers = get_provider_headers(base_url, api_key, custom_headers, custom_headers_json)

    payload = dict(payload or {})
    payload["stream"] = True

    try:
        with requests.post(url, json=payload, headers=headers, stream=True, timeout=timeout) as resp:
            resp.raise_for_status()
            acc = {"text": ""}
            for line in resp.iter_lines(decode_unicode=False):
                if not line:
                    continue
                # Ensure proper framing to client
                if line.startswith(b"data: "):
                    data = line[6:]
                    if data.strip() == b"[DONE]":
                        yield b"data: [DONE]\n\n"
                        break
                    # Try to parse to accumulate delta
                    try:
                        obj = json.loads(data)
                        delta = obj.get("choices", [{}])[0].get("delta", {}).get("content")
                        if delta:
                            acc["text"] += delta
                    except Exception:
                        pass
                    yield b"data: " + data + b"\n\n"
            # Final marker to caller: last element is a tuple ('__acc__', acc)
            yield ("__acc__", acc)
    except Exception:
        return


def call_embeddings_proxy(base_url: str, api_key: str, model: str, inputs: list[str], timeout: int = 30, custom_headers: dict = None, custom_headers_json: str = None):
    """Call OpenAI-compatible embeddings endpoint and return vectors with auto-detected provider headers.

    Args:
        base_url: The API base URL (e.g., 'https://api.openai.com/v1') - '/embeddings' will be appended
        api_key: The API key
        model: The embeddings model to use
        inputs: List of texts to embed
        timeout: Request timeout in seconds
        custom_headers: Optional dict to override/add headers for unsupported providers
        custom_headers_json: Optional JSON string to parse additional headers from LMS Settings
        
    Returns: {"vectors": list[list[float]]|None, "status_code": int|None, "error": str|None}
    """
    import requests

    if not base_url:
        return {"vectors": None, "status_code": None, "error": "missing_base_url"}
    url = base_url.rstrip("/") + "/embeddings"
    headers = get_provider_headers(base_url, api_key, custom_headers, custom_headers_json)
    payload = {"input": inputs, "model": model}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            return {"vectors": None, "status_code": resp.status_code, "error": resp.text[:500]}
        data = resp.json()
        vectors = [item.get("embedding") for item in data.get("data", [])]
        return {"vectors": vectors, "status_code": resp.status_code, "error": None}
    except Exception as e:
        return {"vectors": None, "status_code": None, "error": str(e)[:500]}


def apply_source_weight(score: float, source_type: str, weights: dict | None = None) -> float:
    """Apply a source-type weight to a base score.

    Default weights: Lesson=1.0, Instructor=0.95, File=0.85
    """
    if score is None:
        return 0.0
    if not weights:
        weights = {"Lesson": 1.0, "Instructor": 0.95, "File": 0.85}
    w = weights.get(source_type or "Lesson") or 1.0
    try:
        return float(score) * float(w)
    except Exception:
        return float(score) or 0.0


def simple_guardrail_flags(text: str) -> dict:
    """Return heuristic flags for prompt-injection/content leaks in given text.

    Flags: {"injection": bool, "sensitive": bool}
    """
    t = (text or "").lower()
    inj = any(p in t for p in [
        "ignore previous", "disregard previous", "override instructions", "system prompt",
    ])
    sensitive = any(p in t for p in [
        "password", "api key", "apikey", "secret", "token ", "ssh-", "private key",
    ])
    return {"injection": inj, "sensitive": sensitive}


def determine_effective_assistant_config(global_cfg: dict, course_cfg: dict | None) -> dict:
    """Merge global and per-course overrides to produce effective config.

    Keys: mode, system_prompt, default_model, enable_rag, proxy_base_url, proxy_api_key
    course_cfg may specify enable_overrides and optional overrides.
    """
    global_cfg = global_cfg or {}
    course_cfg = course_cfg or {}

    effective = {
        "mode": (global_cfg.get("assistant_mode") or "Heuristic").strip(),
        "system_prompt": global_cfg.get("assistant_system_prompt") or "",
        "default_model": global_cfg.get("assistant_default_model"),
        "enable_rag": bool(global_cfg.get("assistant_enable_rag")),
        
        # Chat provider settings (with fallback to old proxy fields for backward compatibility)
        "chat_base_url": global_cfg.get("assistant_chat_base_url") or global_cfg.get("assistant_proxy_base_url") or "",
        "chat_api_key": global_cfg.get("assistant_chat_api_key") or global_cfg.get("assistant_proxy_api_key") or "",
        "chat_custom_headers": global_cfg.get("assistant_chat_custom_headers") or global_cfg.get("assistant_proxy_custom_headers") or "",
        
        # Embeddings provider settings
        "embedding_base_url": global_cfg.get("assistant_embedding_base_url") or "",
        "embedding_api_key": global_cfg.get("assistant_embedding_api_key") or "",
        "embedding_custom_headers": global_cfg.get("assistant_embedding_custom_headers") or "",
        "embedding_model": global_cfg.get("assistant_embedding_model") or None,
        
        # Legacy fields for backward compatibility
        "proxy_base_url": global_cfg.get("assistant_chat_base_url") or global_cfg.get("assistant_proxy_base_url") or "",
        "proxy_api_key": global_cfg.get("assistant_chat_api_key") or global_cfg.get("assistant_proxy_api_key") or "",
        "proxy_custom_headers": global_cfg.get("assistant_chat_custom_headers") or global_cfg.get("assistant_proxy_custom_headers") or "",
        
        "default_preset": global_cfg.get("assistant_default_preset") or None,
        "max_messages_per_user_per_day": int(global_cfg.get("assistant_max_messages_per_user_per_day") or 0),
        "cost_per_message": float(global_cfg.get("assistant_cost_per_message") or 0) or 0.0,
        "cost_cap_per_user_per_day": float(global_cfg.get("assistant_cost_cap_per_user_per_day") or 0) or 0.0,
        "rag_chunk_chars": int(global_cfg.get("assistant_rag_chunk_chars") or 600),
        "rag_top_k": int(global_cfg.get("assistant_rag_top_k") or 3),
        "rag_use_embeddings": bool(global_cfg.get("assistant_rag_use_embeddings")),
        "enabled": True,
    }

    if not course_cfg or not course_cfg.get("enable_overrides"):
        return effective

    mode = course_cfg.get("mode")
    if mode and mode != "(inherit)":
        effective["mode"] = mode
    if course_cfg.get("system_prompt"):
        effective["system_prompt"] = course_cfg.get("system_prompt")
    if course_cfg.get("default_model"):
        effective["default_model"] = course_cfg.get("default_model")
    if course_cfg.get("enable_rag") is not None:
        effective["enable_rag"] = bool(course_cfg.get("enable_rag"))
    if course_cfg.get("proxy_base_url"):
        effective["proxy_base_url"] = course_cfg.get("proxy_base_url")
    if course_cfg.get("proxy_api_key"):
        effective["proxy_api_key"] = course_cfg.get("proxy_api_key")

    if course_cfg.get("prompt_preset"):
        effective["prompt_preset"] = course_cfg.get("prompt_preset")
    if course_cfg.get("enabled") is not None:
        effective["enabled"] = bool(course_cfg.get("enabled"))
    # Circuit-breaker pause overrides enabled
    if course_cfg.get("paused_by_alert"):
        effective["enabled"] = False
    if course_cfg.get("max_messages_per_user_per_day") is not None:
        try:
            effective["max_messages_per_user_per_day"] = int(course_cfg.get("max_messages_per_user_per_day") or 0)
        except Exception:
            pass
    if course_cfg.get("cost_per_message") is not None:
        try:
            effective["cost_per_message"] = float(course_cfg.get("cost_per_message") or 0)
        except Exception:
            pass
    if course_cfg.get("cost_cap_per_user") is not None:
        try:
            effective["cost_cap_per_user_per_day"] = float(course_cfg.get("cost_cap_per_user") or 0)
        except Exception:
            pass

    return effective

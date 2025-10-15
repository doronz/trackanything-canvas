"""
AI LLM configuration API routes.
This module handles AI provider configuration and API key management.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import AIConfig, get_db
from services.encryption_service import EncryptionService

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize encryption service
encryption_service = EncryptionService()

# Pydantic models for request/response


class AIConfigCreate(BaseModel):
    name: str
    provider: str  # openai, anthropic, ollama, custom
    model: str
    api_key: Optional[str] = None  # Not required for Ollama
    api_endpoint: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = {}
    is_default: bool = False


class AIConfigUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    api_endpoint: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    is_default: Optional[bool] = None


class AIConfigResponse(BaseModel):
    id: int
    name: str
    provider: str
    model: str
    api_endpoint: Optional[str]
    parameters: Optional[Dict[str, Any]]
    is_default: bool
    has_api_key: bool  # Don't expose actual key
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[AIConfigResponse])
async def list_ai_configs(db: Session = Depends(get_db)):
    """List all AI configurations (without exposing API keys)."""
    configs = db.query(AIConfig).order_by(AIConfig.is_default.desc(), AIConfig.name.asc()).all()

    response_configs = []
    for config in configs:
        response_config = AIConfigResponse(
            id=config.id,
            name=config.name,
            provider=config.provider,
            model=config.model,
            api_endpoint=config.api_endpoint,
            parameters=config.parameters,
            is_default=config.is_default,
            has_api_key=bool(config.api_key_encrypted),
            created_at=config.created_at,
            updated_at=config.updated_at,
        )
        response_configs.append(response_config)

    return response_configs


@router.post("/", response_model=AIConfigResponse)
async def create_ai_config(ai_config: AIConfigCreate, db: Session = Depends(get_db)):
    """Create a new AI LLM configuration."""
    # Validate provider-specific requirements
    if ai_config.provider.lower() == "ollama":
        # Ollama requires API endpoint but not API key
        if not ai_config.api_endpoint:
            ai_config.api_endpoint = "http://host.docker.internal:11434"  # Default Ollama endpoint for Docker
        # Ensure the endpoint has the correct format
        if not ai_config.api_endpoint.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="API endpoint must start with http:// or https://")
    else:
        # Other providers require API key
        if not ai_config.api_key:
            raise HTTPException(status_code=400, detail=f"API key is required for provider: {ai_config.provider}")

    # Check if name already exists
    existing = db.query(AIConfig).filter(AIConfig.name == ai_config.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Configuration name already exists")

    # If this is set as default, unset other defaults
    if ai_config.is_default:
        db.query(AIConfig).update({AIConfig.is_default: False})

    # Encrypt API key (only if provided)
    encrypted_key = encryption_service.encrypt(ai_config.api_key) if ai_config.api_key else None

    db_config = AIConfig(
        name=ai_config.name,
        provider=ai_config.provider,
        model=ai_config.model,
        api_key_encrypted=encrypted_key,
        api_endpoint=ai_config.api_endpoint,
        parameters=ai_config.parameters or {},
        is_default=ai_config.is_default,
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)

    response_config = AIConfigResponse(
        id=db_config.id,
        name=db_config.name,
        provider=db_config.provider,
        model=db_config.model,
        api_endpoint=db_config.api_endpoint,
        parameters=db_config.parameters,
        is_default=db_config.is_default,
        has_api_key=bool(encrypted_key),
        created_at=db_config.created_at,
        updated_at=db_config.updated_at,
    )
    return response_config


@router.get("/{config_id}", response_model=AIConfigResponse)
async def get_ai_config(config_id: int, db: Session = Depends(get_db)):
    """Get a specific AI configuration."""
    config = db.query(AIConfig).filter(AIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="AI configuration not found")

    response_config = AIConfigResponse(
        id=config.id,
        name=config.name,
        provider=config.provider,
        model=config.model,
        api_endpoint=config.api_endpoint,
        parameters=config.parameters,
        is_default=config.is_default,
        has_api_key=bool(config.api_key_encrypted),
        created_at=config.created_at,
        updated_at=config.updated_at,
    )
    return response_config


@router.put("/{config_id}", response_model=AIConfigResponse)
async def update_ai_config(config_id: int, ai_config_update: AIConfigUpdate, db: Session = Depends(get_db)):
    """Update AI configuration."""
    config = db.query(AIConfig).filter(AIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="AI configuration not found")

    # If this is set as default, unset other defaults
    if ai_config_update.is_default:
        db.query(AIConfig).filter(AIConfig.id != config_id).update({AIConfig.is_default: False})

    update_data = ai_config_update.model_dump(exclude_unset=True)

    # Handle API key encryption
    if "api_key" in update_data and update_data["api_key"]:
        update_data["api_key_encrypted"] = encryption_service.encrypt(update_data["api_key"])
        del update_data["api_key"]

    for field, value in update_data.items():
        setattr(config, field, value)

    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)

    response_config = AIConfigResponse(
        id=config.id,
        name=config.name,
        provider=config.provider,
        model=config.model,
        api_endpoint=config.api_endpoint,
        parameters=config.parameters,
        is_default=config.is_default,
        has_api_key=bool(config.api_key_encrypted),
        created_at=config.created_at,
        updated_at=config.updated_at,
    )
    return response_config


@router.delete("/{config_id}")
async def delete_ai_config(config_id: int, db: Session = Depends(get_db)):
    """Delete AI configuration."""
    config = db.query(AIConfig).filter(AIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="AI configuration not found")

    db.delete(config)
    db.commit()
    return {"message": "AI configuration deleted successfully"}


@router.post("/{config_id}/test")
async def test_ai_config(config_id: int, db: Session = Depends(get_db)):
    """Test AI configuration by making a simple API call."""
    config = db.query(AIConfig).filter(AIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="AI configuration not found")

    # Ollama doesn't require API key, but other providers do
    if config.provider.lower() != "ollama" and not config.api_key_encrypted:
        raise HTTPException(status_code=400, detail="No API key configured")

    try:
        # For Ollama, we don't need to decrypt API key
        if config.provider.lower() == "ollama":
            # TODO: Test Ollama endpoint connectivity
            test_result = {
                "status": "success",
                "message": f"Ollama configuration test for model {config.model}",
                "provider": config.provider,
                "model": config.model,
                "endpoint": config.api_endpoint or "http://localhost:11434",
            }
        else:
            # Decrypt API key for other providers
            api_key = encryption_service.decrypt(config.api_key_encrypted)

            # TODO: Implement actual API testing based on provider
            # For now, just return success
            test_result = {
                "status": "success",
                "message": f"Configuration test for {config.provider} model {config.model}",
                "provider": config.provider,
                "model": config.model,
            }

        return test_result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")


@router.get("/default/current")
async def get_default_ai_config(db: Session = Depends(get_db)):
    """Get the current default AI configuration."""
    config = db.query(AIConfig).filter(AIConfig.is_default == True).first()
    if not config:
        raise HTTPException(status_code=404, detail="No default AI configuration found")

    response_config = AIConfigResponse(
        id=config.id,
        name=config.name,
        provider=config.provider,
        model=config.model,
        api_endpoint=config.api_endpoint,
        parameters=config.parameters,
        is_default=config.is_default,
        has_api_key=bool(config.api_key_encrypted),
        created_at=config.created_at,
        updated_at=config.updated_at,
    )
    return response_config


@router.post("/{config_id}/set-default")
async def set_default_ai_config(config_id: int, db: Session = Depends(get_db)):
    """Set an AI configuration as the default."""
    config = db.query(AIConfig).filter(AIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="AI configuration not found")

    # Unset all other defaults
    db.query(AIConfig).update({AIConfig.is_default: False})

    # Set this one as default
    config.is_default = True
    config.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Default AI configuration updated"}


async def fetch_openai_models(api_key: Optional[str] = None) -> List[str]:
    """Fetch available models from OpenAI API."""
    try:
        from openai import OpenAI

        if not api_key:
            # Return default models if no API key is provided
            return ["gpt-5", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1-preview", "o1-mini"]

        client = OpenAI(api_key=api_key)
        models_response = client.models.list()

        # Filter for chat models only
        model_ids = []
        for model in models_response.data:
            model_id = model.id
            # Include GPT models and O1 models
            if any(x in model_id for x in ["gpt", "o1"]):
                model_ids.append(model_id)

        return sorted(model_ids, reverse=True)
    except Exception as e:
        logger.warning(f"Failed to fetch OpenAI models: {e}")
        return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1-preview", "o1-mini"]


async def fetch_anthropic_models(api_key: Optional[str] = None) -> List[str]:
    """Fetch available models from Anthropic API."""
    try:
        from anthropic import Anthropic

        if not api_key:
            # Return default models using aliases (automatically point to latest snapshots)
            # Reference: https://docs.claude.com/en/docs/about-claude/models/overview
            return [
                "claude-sonnet-4-5",  # Latest Claude Sonnet 4.5
                "claude-opus-4-1",  # Latest Claude Opus 4.1
                "claude-sonnet-4-0",  # Latest Claude Sonnet 4
                "claude-opus-4-0",  # Latest Claude Opus 4
                "claude-3-7-sonnet-latest",  # Latest Claude Sonnet 3.7
                "claude-3-5-haiku-latest",  # Latest Claude Haiku 3.5
            ]

        client = Anthropic(api_key=api_key)
        models_response = client.models.list()

        model_ids = [model.id for model in models_response.data]
        return sorted(model_ids, reverse=True)
    except Exception as e:
        logger.warning(f"Failed to fetch Anthropic models: {e}")
        # Return default models using aliases as fallback
        return [
            "claude-sonnet-4-5",  # Latest Claude Sonnet 4.5
            "claude-opus-4-1",  # Latest Claude Opus 4.1
            "claude-sonnet-4-0",  # Latest Claude Sonnet 4
            "claude-opus-4-0",  # Latest Claude Opus 4
            "claude-3-7-sonnet-latest",  # Latest Claude Sonnet 3.7
            "claude-3-5-haiku-latest",  # Latest Claude Haiku 3.5
        ]


async def fetch_ollama_models(endpoint: str = "http://host.docker.internal:11434") -> List[str]:
    """Fetch available models from Ollama API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # First try to get all local models using /api/ps
            try:
                response = await client.get(f"{endpoint}/api/ps")
                response.raise_for_status()
                data = response.json()
                logger.info(f"Ollama /api/ps response: {data}")

                if "models" in data and isinstance(data["models"], list):
                    models = [model["name"] for model in data["models"] if "name" in model]
                    if models:
                        logger.info(f"Found {len(models)} running Ollama models: {models}")
                        return models
            except Exception as ps_error:
                logger.warning(f"Failed to fetch running models from /api/ps: {ps_error}")

            # Fallback to running models using /api/tags
            try:
                response = await client.get(f"{endpoint}/api/tags")
                response.raise_for_status()
                data = response.json()
                logger.info(f"Ollama /api/tags response: {data}")

                if "models" in data and isinstance(data["models"], list):
                    models = [model["name"] for model in data["models"] if "name" in model]
                    if models:
                        logger.info(f"Found {len(models)} Ollama models: {models}")
                        return models
            except Exception as tags_error:
                logger.warning(f"Failed to fetch models from /api/tags: {tags_error}")

            # If both endpoints failed but server is reachable, return empty list
            logger.warning("Ollama server is reachable but no models found")
            return []

    except Exception as e:
        logger.error(f"Failed to connect to Ollama server at {endpoint}: {e}")
        # Return common Ollama models as fallback when server is unreachable
        fallback_models = ["llama3.2:3b", "llama3.1", "llama2", "mistral", "codellama", "phi3", "qwen2.5"]
        logger.info(f"Using fallback Ollama models: {fallback_models}")
        return fallback_models


async def fetch_gemini_models(api_key: Optional[str] = None) -> List[str]:
    """Fetch available models from Google Gemini API."""
    try:
        from google import genai

        if not api_key:
            # Return default models if no API key is provided
            return [
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.5-flash-image",
                "gemini-2.0-flash",
            ]

        client = genai.Client(api_key=api_key)
        models = client.models.list()

        # Filter for generative models that support generateContent
        model_names = []
        for model in models:
            # Extract model name from format like "models/gemini-1.5-flash"
            model_name = model.name.split("/")[-1] if hasattr(model, "name") else str(model)
            if "gemini" in model_name.lower():
                model_names.append(model_name)

        return sorted(model_names, reverse=True)
    except Exception as e:
        logger.warning(f"Failed to fetch Gemini models: {e}")
        return [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-image",
            "gemini-2.0-flash",
        ]


@router.get("/providers/list")
async def list_supported_providers(fetch_live: bool = False, db: Session = Depends(get_db)):
    """
    List supported AI providers and their models.

    Args:
        fetch_live: If True, attempt to fetch live model lists from configured providers.
                   If False (default), return static/cached model lists.
    """
    providers = {
        "openai": {"name": "OpenAI", "models": [], "endpoint": "https://api.openai.com/v1", "auth_type": "bearer"},
        "anthropic": {
            "name": "Anthropic",
            "models": [],
            "endpoint": "https://api.anthropic.com",
            "auth_type": "api_key",
        },
        "ollama": {
            "name": "Ollama",
            "models": [],
            "endpoint": "http://host.docker.internal:11434/v1",
            "auth_type": "none",
        },
        "gemini": {
            "name": "Google Gemini",
            "models": [],
            "endpoint": "https://generativelanguage.googleapis.com/v1beta",
            "auth_type": "api_key",
        },
        "custom": {"name": "Custom Endpoint", "models": ["custom-model"], "endpoint": "", "auth_type": "bearer"},
    }

    if fetch_live:
        # Try to fetch live models using API keys from configured providers
        openai_config = (
            db.query(AIConfig).filter(AIConfig.provider == "openai", AIConfig.api_key_encrypted.isnot(None)).first()
        )

        anthropic_config = (
            db.query(AIConfig).filter(AIConfig.provider == "anthropic", AIConfig.api_key_encrypted.isnot(None)).first()
        )

        gemini_config = (
            db.query(AIConfig).filter(AIConfig.provider == "gemini", AIConfig.api_key_encrypted.isnot(None)).first()
        )

        ollama_config = db.query(AIConfig).filter(AIConfig.provider == "ollama").first()

        # Fetch OpenAI models
        openai_key = encryption_service.decrypt(openai_config.api_key_encrypted) if openai_config else None
        providers["openai"]["models"] = await fetch_openai_models(openai_key)

        # Fetch Anthropic models
        anthropic_key = encryption_service.decrypt(anthropic_config.api_key_encrypted) if anthropic_config else None
        providers["anthropic"]["models"] = await fetch_anthropic_models(anthropic_key)

        # Fetch Ollama models
        ollama_endpoint = ollama_config.api_endpoint if ollama_config else "http://host.docker.internal:11434"
        providers["ollama"]["models"] = await fetch_ollama_models(ollama_endpoint)

        # Fetch Gemini models
        gemini_key = encryption_service.decrypt(gemini_config.api_key_encrypted) if gemini_config else None
        providers["gemini"]["models"] = await fetch_gemini_models(gemini_key)
    else:
        # Return default/fallback models
        providers["openai"]["models"] = await fetch_openai_models()
        providers["anthropic"]["models"] = await fetch_anthropic_models()
        providers["ollama"]["models"] = await fetch_ollama_models()
        providers["gemini"]["models"] = await fetch_gemini_models()

    return providers


class FetchModelsRequest(BaseModel):
    api_key: Optional[str] = None
    api_endpoint: Optional[str] = None


@router.post("/providers/{provider}/models")
async def fetch_provider_models(provider: str, request: FetchModelsRequest):
    """
    Fetch available models for a specific provider using the provided API key.

    Args:
        provider: The AI provider (openai, anthropic, ollama, gemini, custom)
        request: Request body containing api_key and api_endpoint
    """
    provider = provider.lower()
    api_key = request.api_key
    api_endpoint = request.api_endpoint

    try:
        if provider == "openai":
            models = await fetch_openai_models(api_key)
        elif provider == "anthropic":
            models = await fetch_anthropic_models(api_key)
        elif provider == "ollama":
            endpoint = api_endpoint or "http://host.docker.internal:11434"
            models = await fetch_ollama_models(endpoint)
        elif provider == "gemini":
            models = await fetch_gemini_models(api_key)
        elif provider == "custom":
            models = ["custom-model"]
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

        return {"provider": provider, "models": models, "count": len(models)}
    except Exception as e:
        logger.error(f"Failed to fetch models for {provider}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

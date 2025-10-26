"""
AI Chat API routes with MCP integration.
This module handles AI chat interactions with integrated MCP tool calling capabilities.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

import anthropic
import openai
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import AIConfig, get_db
from services.encryption_service import EncryptionService
from services.mcp_service import mcp_service

router = APIRouter()

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize services
encryption_service = EncryptionService()
# mcp_service is imported as singleton from services.mcp_service

# Pydantic models for request/response


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: str


class ChatRequest(BaseModel):
    message: str
    ai_config_id: Optional[int] = None
    conversation_history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    message: str
    role: str = "assistant"
    timestamp: str
    tools_used: List[Dict[str, Any]] = []


class SimpleGenerateRequest(BaseModel):
    prompt: str
    ai_config_id: Optional[int] = None


class SimpleGenerateResponse(BaseModel):
    response: str


@router.post("/generate", response_model=SimpleGenerateResponse)
async def generate_content(request: SimpleGenerateRequest, db: Session = Depends(get_db)):
    """
    Simple content generation endpoint without tool calling.
    Useful for widget init_prompt content generation.
    """
    # Get AI configuration
    if request.ai_config_id:
        ai_config = db.query(AIConfig).filter(AIConfig.id == request.ai_config_id).first()
    else:
        ai_config = db.query(AIConfig).filter(AIConfig.is_default.is_(True)).first()

    if not ai_config:
        raise HTTPException(status_code=404, detail="No AI configuration found")

    # Decrypt API key if needed
    api_key = None
    if ai_config.api_key_encrypted:
        api_key = encryption_service.decrypt(ai_config.api_key_encrypted)

    # Create simple message
    messages = [{"role": "user", "content": request.prompt}]

    try:
        # Call AI API based on provider WITHOUT tools
        if ai_config.provider == "openai":
            response_content = await _simple_call_openai(api_key, ai_config, messages)
        elif ai_config.provider == "anthropic":
            response_content = await _simple_call_anthropic(api_key, ai_config, messages)
        elif ai_config.provider == "ollama":
            response_content = await _simple_call_ollama(ai_config, messages)
        elif ai_config.provider == "gemini":
            response_content = await _simple_call_gemini(api_key, ai_config, messages)
        else:
            raise HTTPException(status_code=400, detail=f"Provider '{ai_config.provider}' not supported")

        return SimpleGenerateResponse(response=response_content)
    except Exception as e:
        logger.error(f"Error generating content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating content: {str(e)}")


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(chat_request: ChatRequest, db: Session = Depends(get_db)):
    """
    Send a message to AI with MCP tool integration.
    """
    # Get AI configuration
    if chat_request.ai_config_id:
        ai_config = db.query(AIConfig).filter(AIConfig.id == chat_request.ai_config_id).first()
    else:
        ai_config = db.query(AIConfig).filter(AIConfig.is_default.is_(True)).first()

    if not ai_config:
        raise HTTPException(status_code=404, detail="No AI configuration found")

    # Ollama doesn't require API key, but other providers do
    if ai_config.provider.lower() != "ollama" and not ai_config.api_key_encrypted:
        raise HTTPException(status_code=400, detail="AI configuration has no API key")

    try:
        # Decrypt API key (not needed for Ollama)
        api_key = None
        if ai_config.provider.lower() != "ollama" and ai_config.api_key_encrypted:
            api_key = encryption_service.decrypt(ai_config.api_key_encrypted)

        # Get available MCP tools
        mcp_servers_status = await mcp_service.get_all_servers_status()
        available_tools = []

        # Debug logging for MCP server status
        logger.debug(f"MCP Servers Status: {mcp_servers_status}")

        for server in mcp_servers_status:
            logger.debug(f"Checking server: {server['name']}, status: {server['status']}, tools: {server['tools']}")
            # Only include tools from connected servers for reliability
            if server["status"] == "connected":
                for tool in server["tools"]:
                    # Get tool parameters or provide default schema
                    parameters = tool.get("parameters", {})

                    # If no parameters provided, use a minimal valid JSON schema
                    if not parameters or parameters == {}:
                        parameters = {"type": "object", "properties": {}, "required": []}

                    available_tools.append(
                        {
                            "type": "function",
                            "function": {
                                "name": f"{server['name'].replace(' ', '_')}_{tool['name']}",
                                "description": tool["description"],
                                "parameters": parameters,
                            },
                        }
                    )

        # Debug logging for available tools
        logger.debug(f"Available Tools for AI: {available_tools}")

        # Prepare messages
        messages = []
        for msg in chat_request.conversation_history:
            messages.append({"role": msg.role, "content": msg.content})

        # Add current user message
        messages.append({"role": "user", "content": chat_request.message})

        # Add system message about available tools
        if available_tools:
            system_message = f"You have access to the following MCP tools: {[tool['function']['name'] for tool in available_tools]}. Use them when helpful to answer user questions."
            messages.insert(0, {"role": "system", "content": system_message})

        tools_used = []
        response_content = ""

        # Check if provider supports tool calling and filter tools accordingly
        filtered_tools = available_tools if _provider_supports_tools(ai_config) else []

        # Add system message about tool availability
        if available_tools and not filtered_tools:
            # Tools available but not supported by this provider
            no_tools_message = f"Note: MCP tools are available but not supported by {ai_config.provider} with model {ai_config.model}. Consider using OpenAI or Anthropic for tool calling."
            messages.insert(0, {"role": "system", "content": no_tools_message})

        # Call AI API based on provider
        if ai_config.provider == "openai":
            response_content, tools_used = await _call_openai(api_key, ai_config, messages, filtered_tools)
        elif ai_config.provider == "anthropic":
            response_content, tools_used = await _call_anthropic(api_key, ai_config, messages, filtered_tools)
        elif ai_config.provider == "ollama":
            response_content, tools_used = await _call_ollama(ai_config, messages, filtered_tools)
        elif ai_config.provider == "gemini":
            response_content, tools_used = await _call_gemini(api_key, ai_config, messages, filtered_tools)
        else:
            # TODO: Implement custom provider support
            response_content = f"Custom provider '{ai_config.provider}' not yet implemented."

        return ChatResponse(
            message=response_content,
            timestamp=chat_request.conversation_history[-1].timestamp if chat_request.conversation_history else "",
            tools_used=tools_used,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat failed: {str(e)}")


def _provider_supports_tools(ai_config: AIConfig) -> bool:
    """Check if the AI provider and model support tool calling."""
    provider = ai_config.provider.lower()
    # model check could be added here for future fine-grained support

    # OpenAI and Anthropic have robust tool calling support
    if provider in ["openai", "anthropic"]:
        return True

    # Gemini supports tool calling via native MCP integration when FastMCP is available
    if provider == "gemini":
        try:
            # Check if required dependencies are available
            import google.genai  # noqa: F401
            from fastmcp import Client  # noqa: F401

            return True  # Gemini has native MCP support via FastMCP
        except ImportError:
            # Without google-genai or fastmcp, no tool support
            logger.info("Gemini MCP support requires 'google-genai' and 'fastmcp' packages")
            return False

    # Ollama: Some models support tool calling, but we can't reliably determine which ones
    if provider == "ollama":
        # Return True to allow tool calling attempts, but we'll show a warning to users
        # that not all Ollama models support tool calling
        return True

    # Custom providers - assume no tool support unless explicitly configured
    return False


async def _call_openai(
    api_key: str, ai_config: AIConfig, messages: List[Dict], available_tools: List[Dict]
) -> tuple[str, List[Dict]]:
    """Call OpenAI API with tool support."""
    client = openai.AsyncOpenAI(api_key=api_key, base_url=ai_config.api_endpoint if ai_config.api_endpoint else None)

    tools_used = []

    # Prepare request parameters
    request_params = {
        "model": ai_config.model,
        "messages": messages,
        "temperature": ai_config.parameters.get("temperature", 0.7),
        "max_tokens": ai_config.parameters.get("max_tokens", 1000),
    }

    if available_tools:
        request_params["tools"] = available_tools
        request_params["tool_choice"] = "auto"

    # Enhanced debug logging for OpenAI request
    logger.debug("=" * 80)
    logger.debug(f"🤖 OPENAI REQUEST - Model: {ai_config.model}")
    logger.debug(
        f"📨 Request Parameters: {json.dumps({k: v for k, v in request_params.items() if k != 'messages'}, indent=2)}"
    )
    logger.debug(f"💬 Messages ({len(messages)} total):")
    for i, msg in enumerate(messages):
        logger.debug(f"  [{i}] {msg['role']}: {msg['content'][:200]}{'...' if len(msg['content']) > 200 else ''}")
    if available_tools:
        logger.debug(f"🔧 Available Tools: {[tool['function']['name'] for tool in available_tools]}")
    logger.debug("=" * 80)

    # Initial AI call
    start_time = time.time()
    response = await client.chat.completions.create(**request_params)
    end_time = time.time()

    # Enhanced debug logging for OpenAI response
    logger.debug("=" * 80)
    logger.debug(f"🤖 OPENAI RESPONSE - Model: {ai_config.model} (took {end_time - start_time:.2f}s)")
    logger.debug(f"📥 Response Choice 0:")
    logger.debug(f"  Content: {response.choices[0].message.content}")
    logger.debug(f"  Finish Reason: {response.choices[0].finish_reason}")
    if hasattr(response.choices[0].message, "tool_calls") and response.choices[0].message.tool_calls:
        logger.debug(f"  Tool Calls: {len(response.choices[0].message.tool_calls)}")
        for i, tool_call in enumerate(response.choices[0].message.tool_calls):
            logger.debug(f"    [{i}] {tool_call.function.name}({tool_call.function.arguments})")
    logger.debug(f"📊 Usage: {response.usage.model_dump() if hasattr(response, 'usage') and response.usage else 'N/A'}")
    logger.debug("=" * 80)

    # Check if AI wants to use tools
    message = response.choices[0].message

    if message.tool_calls:
        # Execute tool calls
        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            # Parse tool name - find original mapping from available_tools
            original_mapping = None
            for tool in available_tools:
                if tool["function"]["name"] == tool_name:
                    # Extract server name from the original description or reconstruct
                    # Tool name format: "Server_Name_tool_name"
                    # We need to find the boundary between server and tool

                    # Try to find server name by checking registered servers
                    for server in await mcp_service.get_all_servers_status():
                        server_prefix = server["name"].replace(" ", "_")
                        if tool_name.startswith(server_prefix + "_"):
                            server_name = server["name"]
                            actual_tool_name = tool_name[len(server_prefix) + 1 :]
                            original_mapping = (server_name, actual_tool_name)
                            break
                    break

            if not original_mapping:
                logger.error(f"Could not parse tool name: {tool_name}")
                continue

            server_name, actual_tool_name = original_mapping
            parameters = json.loads(tool_call.function.arguments)

            try:
                # Enhanced debug logging for tool execution
                logger.debug("=" * 80)
                logger.debug(f"🔧 TOOL EXECUTION - OpenAI")
                logger.debug(f"Tool: {tool_name} -> {server_name}.{actual_tool_name}")
                logger.debug(f"Parameters: {json.dumps(parameters, indent=2)}")

                tool_start_time = time.time()
                tool_result = await mcp_service.call_tool(server_name, actual_tool_name, parameters)
                tool_end_time = time.time()

                logger.debug(f"✅ Tool Result (took {tool_end_time - tool_start_time:.2f}s):")
                logger.debug(f"  Result: {str(tool_result)[:500]}{'...' if len(str(tool_result)) > 500 else ''}")
                logger.debug("=" * 80)

                tools_used.append({"tool_name": tool_name, "parameters": parameters, "result": tool_result})

                # Add tool result to conversation
                messages.append({"role": "assistant", "content": "", "tool_calls": [tool_call.model_dump()]})
                messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": json.dumps(tool_result)})

            except Exception as e:
                # Enhanced debug logging for tool errors
                logger.debug("=" * 80)
                logger.debug(f"❌ TOOL ERROR - OpenAI")
                logger.debug(f"Tool: {tool_name} -> {server_name}.{actual_tool_name}")
                logger.debug(f"Error: {str(e)}")
                logger.debug("=" * 80)

                tools_used.append({"tool_name": tool_name, "parameters": parameters, "error": str(e)})

        # Get final response with tool results
        final_start_time = time.time()
        final_response = await client.chat.completions.create(**request_params)
        final_end_time = time.time()

        # Enhanced debug logging for OpenAI final response with tools
        logger.debug("=" * 80)
        logger.debug(f"🤖 OPENAI FINAL RESPONSE - After Tool Execution (took {final_end_time - final_start_time:.2f}s)")
        logger.debug(f"📥 Final Content: {final_response.choices[0].message.content}")
        logger.debug(
            f"📊 Final Usage: {final_response.usage.model_dump() if hasattr(final_response, 'usage') and final_response.usage else 'N/A'}"
        )
        logger.debug("=" * 80)

        return final_response.choices[0].message.content, tools_used

    return message.content, tools_used


async def _call_anthropic(
    api_key: str, ai_config: AIConfig, messages: List[Dict], available_tools: List[Dict]
) -> tuple[str, List[Dict]]:
    """Call Anthropic API with tool support."""
    client = anthropic.AsyncAnthropic(api_key=api_key)

    tools_used = []

    # Convert OpenAI-style tools to Anthropic format
    anthropic_tools = []
    for tool in available_tools:
        # Get tool parameters or provide default schema
        parameters = tool["function"].get("parameters", {})

        # If no parameters provided, use a minimal valid JSON schema
        if not parameters or parameters == {}:
            input_schema = {"type": "object", "properties": {}, "required": []}
        else:
            input_schema = parameters

        anthropic_tools.append(
            {
                "name": tool["function"]["name"].replace(".", "_"),  # Replace dots with underscores for Anthropic
                "description": tool["function"]["description"],
                "input_schema": input_schema,
            }
        )

    # Prepare messages (Anthropic format)
    anthropic_messages = []
    system_message = ""

    for msg in messages:
        if msg["role"] == "system":
            system_message = msg["content"]
        else:
            anthropic_messages.append({"role": msg["role"], "content": msg["content"]})

    request_params = {
        "model": ai_config.model,
        "messages": anthropic_messages,
        "max_tokens": ai_config.parameters.get("max_tokens", 1000),
        "temperature": ai_config.parameters.get("temperature", 0.7),
    }

    if system_message:
        request_params["system"] = system_message

    if anthropic_tools:
        request_params["tools"] = anthropic_tools

    # Enhanced debug logging for Anthropic request
    logger.debug("=" * 80)
    logger.debug(f"🤖 ANTHROPIC REQUEST - Model: {ai_config.model}")
    logger.debug(
        f"📨 Request Parameters: {json.dumps({k: v for k, v in request_params.items() if k not in ['messages', 'tools']}, indent=2)}"
    )
    logger.debug(f"💬 Messages ({len(anthropic_messages)} total):")
    for i, msg in enumerate(anthropic_messages):
        logger.debug(f"  [{i}] {msg['role']}: {msg['content'][:200]}{'...' if len(msg['content']) > 200 else ''}")
    if anthropic_tools:
        logger.debug(f"🔧 Available Tools: {[tool['name'] for tool in anthropic_tools]}")
    if system_message:
        logger.debug(f"🎯 System Message: {system_message[:200]}{'...' if len(system_message) > 200 else ''}")
    logger.debug("=" * 80)

    # Initial AI call
    try:
        start_time = time.time()
        response = await client.messages.create(**request_params)
        end_time = time.time()
    except Exception as e:
        # Enhanced error logging
        logger.debug("=" * 80)
        logger.debug(f"❌ ANTHROPIC API ERROR")
        logger.debug(f"Error: {str(e)}")
        if hasattr(e, "response") and e.response:
            try:
                error_content = e.response.content.decode() if hasattr(e.response, "content") else str(e.response.text)
                logger.debug(f"API Error Response: {error_content}")
            except:
                logger.debug(f"API Error Response (raw): {e.response}")
        logger.debug("=" * 80)
        raise

    # Enhanced debug logging for Anthropic response
    logger.debug("=" * 80)
    logger.debug(f"🤖 ANTHROPIC RESPONSE - Model: {ai_config.model} (took {end_time - start_time:.2f}s)")
    logger.debug(f"📥 Response Content ({len(response.content)} blocks):")
    for i, block in enumerate(response.content):
        if block.type == "text":
            logger.debug(f"  [{i}] text: {block.text[:200]}{'...' if len(block.text) > 200 else ''}")
        elif block.type == "tool_use":
            logger.debug(f"  [{i}] tool_use: {block.name}({block.input})")
    logger.debug(f"📊 Usage: {response.usage.model_dump() if hasattr(response, 'usage') and response.usage else 'N/A'}")
    logger.debug("=" * 80)

    # Check if AI wants to use tools
    tool_calls = [block for block in response.content if block.type == "tool_use"]

    if tool_calls:
        # Execute tool calls
        for tool_call in tool_calls:
            tool_name = tool_call.name
            # For Anthropic, dots were replaced with underscores
            # Expected format: "Server_Name_tool_name" -> "Server Name" + "tool_name"
            # We need to handle compound tool names like "get_stories"

            # Find the original server and tool name mapping
            # The tool was originally registered as "server.tool" but converted to "server_tool" for Anthropic
            original_name = None
            for tool in available_tools:
                anthropic_name = tool["function"]["name"].replace(".", "_")
                if anthropic_name == tool_name:
                    original_name = tool["function"]["name"]
                    break

            if original_name:
                # Parse the original name: "Server_Name.tool_name"
                # Convert underscores back to spaces for server name
                server_part, actual_tool_name = original_name.split(".", 1)
                server_name = server_part.replace("_", " ")
            else:
                # Fallback parsing if we can't find the original mapping
                # Try to split by finding known servers first
                if tool_name.startswith("Hacker_News_"):
                    server_name = "Hacker News"
                    actual_tool_name = tool_name[len("Hacker_News_") :]
                elif tool_name.startswith("GitHub_"):
                    server_name = "GitHub"
                    actual_tool_name = tool_name[len("GitHub_") :]
                else:
                    # Generic fallback - assume first two parts are server name
                    parts = tool_name.split("_")
                    if len(parts) >= 3:
                        server_name = " ".join(parts[:2])
                        actual_tool_name = "_".join(parts[2:])
                    else:
                        server_name = parts[0].replace("_", " ")
                        actual_tool_name = "_".join(parts[1:])

            # Debug logging for parsed names
            logger.debug(
                f"Tool parsing - Original tool_name: {tool_name}, Parsed server: {server_name}, Parsed tool: {actual_tool_name}, Original mapping: {original_name}"
            )

            parameters = tool_call.input

            try:
                # Enhanced debug logging for tool execution
                logger.debug("=" * 80)
                logger.debug(f"🔧 TOOL EXECUTION - Anthropic")
                logger.debug(f"Tool: {tool_name} -> {server_name}.{actual_tool_name}")
                logger.debug(f"Parameters: {json.dumps(parameters, indent=2)}")

                tool_start_time = time.time()
                tool_result = await mcp_service.call_tool(server_name, actual_tool_name, parameters)
                tool_end_time = time.time()

                logger.debug(f"✅ Tool Result (took {tool_end_time - tool_start_time:.2f}s):")
                logger.debug(f"  Result: {str(tool_result)[:500]}{'...' if len(str(tool_result)) > 500 else ''}")
                logger.debug("=" * 80)

                tools_used.append({"tool_name": tool_name, "parameters": parameters, "result": tool_result})

                # Extract text content from CallToolResult
                if hasattr(tool_result, "content") and tool_result.content:
                    # Get the text content from the first content item
                    if len(tool_result.content) > 0 and hasattr(tool_result.content[0], "text"):
                        result_text = tool_result.content[0].text
                    else:
                        result_text = str(tool_result)
                else:
                    result_text = str(tool_result)

                # Add tool result to conversation
                anthropic_messages.append({"role": "assistant", "content": response.content})
                anthropic_messages.append(
                    {
                        "role": "user",
                        "content": [{"type": "tool_result", "tool_use_id": tool_call.id, "content": result_text}],
                    }
                )

            except Exception as e:
                # Enhanced debug logging for tool errors
                logger.debug("=" * 80)
                logger.debug(f"❌ TOOL ERROR - Anthropic")
                logger.debug(f"Tool: {tool_name} -> {server_name}.{actual_tool_name}")
                logger.debug(f"Error: {str(e)}")
                logger.debug("=" * 80)

                tools_used.append({"tool_name": tool_name, "parameters": parameters, "error": str(e)})

        # Get final response with tool results
        request_params["messages"] = anthropic_messages
        final_start_time = time.time()
        final_response = await client.messages.create(**request_params)
        final_end_time = time.time()

        # Enhanced debug logging for Anthropic final response with tools
        logger.debug("=" * 80)
        logger.debug(
            f"🤖 ANTHROPIC FINAL RESPONSE - After Tool Execution (took {final_end_time - final_start_time:.2f}s)"
        )
        logger.debug(f"📥 Final Content ({len(final_response.content)} blocks):")
        for i, block in enumerate(final_response.content):
            if block.type == "text":
                logger.debug(f"  [{i}] text: {block.text[:200]}{'...' if len(block.text) > 200 else ''}")
        logger.debug(
            f"📊 Final Usage: {final_response.usage.model_dump() if hasattr(final_response, 'usage') and final_response.usage else 'N/A'}"
        )
        logger.debug("=" * 80)

        # Extract text content
        text_content = ""
        for block in final_response.content:
            if block.type == "text":
                text_content += block.text

        return text_content, tools_used

    # Extract text content from initial response
    text_content = ""
    for block in response.content:
        if block.type == "text":
            text_content += block.text

    return text_content, tools_used


async def _call_ollama(
    ai_config: AIConfig, messages: List[Dict], available_tools: List[Dict]
) -> tuple[str, List[Dict]]:
    """Call Ollama API using the official Ollama Python library with tool support."""
    tools_used = []

    try:
        # Create Ollama client with custom host if specified
        from ollama import AsyncClient

        client_kwargs = {}
        if ai_config.api_endpoint:
            client_kwargs["host"] = ai_config.api_endpoint

        client = AsyncClient(**client_kwargs)

        # Convert messages to Ollama format (should already be compatible)
        ollama_messages = []
        for msg in messages:
            ollama_messages.append({"role": msg["role"], "content": msg["content"]})

        # Prepare request parameters
        request_params = {"model": ai_config.model, "messages": ollama_messages}

        # Add tools if available (Ollama uses similar format to OpenAI)
        if available_tools:
            # Convert tools to Ollama format
            ollama_tools = []
            for tool in available_tools:
                ollama_tools.append(
                    {
                        "type": "function",
                        "function": {
                            "name": tool["function"]["name"],
                            "description": tool["function"]["description"],
                            "parameters": tool["function"]["parameters"],
                        },
                    }
                )
            request_params["tools"] = ollama_tools

        # Add options from ai_config.parameters if available
        if ai_config.parameters:
            options = {}
            if "temperature" in ai_config.parameters:
                options["temperature"] = ai_config.parameters["temperature"]
            if "max_tokens" in ai_config.parameters:
                options["num_predict"] = ai_config.parameters["max_tokens"]  # Ollama uses num_predict
            if options:
                request_params["options"] = options

        # Enhanced debug logging for Ollama request
        logger.debug("=" * 80)
        logger.debug(f"🤖 OLLAMA REQUEST - Model: {ai_config.model}")
        logger.debug(
            f"📨 Request Parameters: {json.dumps({k: v for k, v in request_params.items() if k not in ['messages', 'tools']}, indent=2)}"
        )
        logger.debug(f"💬 Messages ({len(ollama_messages)} total):")
        for i, msg in enumerate(ollama_messages):
            logger.debug(f"  [{i}] {msg['role']}: {msg['content'][:200]}{'...' if len(msg['content']) > 200 else ''}")
        if available_tools:
            logger.debug(f"🔧 Available Tools: {[tool['function']['name'] for tool in available_tools]}")
        logger.debug("=" * 80)

        # Initial AI call
        start_time = time.time()
        try:
            response = await client.chat(**request_params)
        except Exception as e:
            # If model doesn't support tools (400 error), retry without tools
            error_msg = str(e).lower()
            if "does not support tools" in error_msg or "400" in error_msg:
                logger.warning(f"Ollama model {ai_config.model} does not support tools, retrying without tools")
                # Remove tools from request and retry
                if "tools" in request_params:
                    del request_params["tools"]
                response = await client.chat(**request_params)
            else:
                raise

        end_time = time.time()

        # Enhanced debug logging for Ollama response
        logger.debug("=" * 80)
        logger.debug(f"🤖 OLLAMA RESPONSE - Model: {ai_config.model} (took {end_time - start_time:.2f}s)")
        logger.debug(f"📥 Response Message: {response.get('message', {})}")
        if response.get("message", {}).get("tool_calls"):
            logger.debug(f"🔧 Tool Calls: {len(response['message']['tool_calls'])}")
            for i, tool_call in enumerate(response["message"]["tool_calls"]):
                logger.debug(f"  [{i}] {tool_call}")
        logger.debug("=" * 80)

        # Check if AI wants to use tools
        message = response.get("message", {})
        tool_calls = message.get("tool_calls", [])

        if tool_calls:
            # Execute tool calls
            for tool_call in tool_calls:
                function_call = tool_call.get("function", {})
                tool_name = function_call.get("name", "")

                # Parse tool name - find original mapping from available_tools
                original_mapping = None
                for tool in available_tools:
                    if tool["function"]["name"] == tool_name:
                        # Extract server name from the tool name
                        # Tool name format: "Server_Name_tool_name"
                        # Try to find server name by checking registered servers
                        mcp_servers_status = await mcp_service.get_all_servers_status()
                        for server in mcp_servers_status:
                            server_prefix = server["name"].replace(" ", "_")
                            if tool_name.startswith(server_prefix + "_"):
                                server_name = server["name"]
                                actual_tool_name = tool_name[len(server_prefix) + 1 :]
                                original_mapping = (server_name, actual_tool_name)
                                break
                        break

                if not original_mapping:
                    logger.error(f"Could not parse tool name: {tool_name}")
                    continue

                server_name, actual_tool_name = original_mapping
                parameters = function_call.get("arguments", {})

                # Handle arguments as string (JSON) or dict
                if isinstance(parameters, str):
                    try:
                        parameters = json.loads(parameters)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse tool arguments: {parameters}")
                        continue

                try:
                    # Enhanced debug logging for tool execution
                    logger.debug("=" * 80)
                    logger.debug(f"🔧 TOOL EXECUTION - Ollama")
                    logger.debug(f"Tool: {tool_name} -> {server_name}.{actual_tool_name}")
                    logger.debug(f"Parameters: {json.dumps(parameters, indent=2)}")

                    tool_start_time = time.time()
                    tool_result = await mcp_service.call_tool(server_name, actual_tool_name, parameters)
                    tool_end_time = time.time()

                    logger.debug(f"✅ Tool Result (took {tool_end_time - tool_start_time:.2f}s):")
                    logger.debug(f"  Result: {str(tool_result)[:500]}{'...' if len(str(tool_result)) > 500 else ''}")
                    logger.debug("=" * 80)

                    tools_used.append({"tool_name": tool_name, "parameters": parameters, "result": tool_result})

                    # Add tool result to conversation
                    ollama_messages.append({"role": "assistant", "content": "", "tool_calls": [tool_call]})

                    # Extract result text
                    if hasattr(tool_result, "content") and tool_result.content:
                        if len(tool_result.content) > 0 and hasattr(tool_result.content[0], "text"):
                            result_text = tool_result.content[0].text
                        else:
                            result_text = str(tool_result)
                    else:
                        result_text = str(tool_result)

                    ollama_messages.append({"role": "tool", "content": result_text})

                except Exception as e:
                    # Enhanced debug logging for tool errors
                    logger.debug("=" * 80)
                    logger.debug(f"❌ TOOL ERROR - Ollama")
                    logger.debug(f"Tool: {tool_name} -> {server_name}.{actual_tool_name}")
                    logger.debug(f"Error: {str(e)}")
                    logger.debug("=" * 80)

                    tools_used.append({"tool_name": tool_name, "parameters": parameters, "error": str(e)})

            # Get final response with tool results
            request_params["messages"] = ollama_messages
            final_start_time = time.time()
            final_response = await client.chat(**request_params)
            final_end_time = time.time()

            # Enhanced debug logging for Ollama final response with tools
            logger.debug("=" * 80)
            logger.debug(
                f"🤖 OLLAMA FINAL RESPONSE - After Tool Execution (took {final_end_time - final_start_time:.2f}s)"
            )
            logger.debug(f"📥 Final Message: {final_response.get('message', {})}")
            logger.debug("=" * 80)

            return final_response.get("message", {}).get("content", ""), tools_used

        # Extract the message content from initial response
        message_content = message.get("content", "")
        return message_content, tools_used

    except Exception as e:
        logger.error(f"Ollama API call failed: {str(e)}")
        raise Exception(f"Ollama API call failed: {str(e)}")


@router.get("/available-tools")
async def get_available_tools():
    """Get list of available MCP tools."""
    try:
        mcp_servers_status = await mcp_service.get_all_servers_status()
        tools = []

        for server in mcp_servers_status:
            if server["status"] == "connected":
                for tool in server["tools"]:
                    tools.append(
                        {
                            "server": server["name"],
                            "name": tool["name"],
                            "description": tool["description"],
                            "full_name": f"{server['name']}.{tool['name']}",
                        }
                    )

        return {"tools": tools}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available tools: {str(e)}")


@router.get("/tool-support-status")
async def get_tool_support_status(db: Session = Depends(get_db)):
    """Get tool calling support status for all AI configurations."""
    try:
        # Get all AI configurations
        from database import AIConfig

        ai_configs = db.query(AIConfig).all()

        support_status = []
        for config in ai_configs:
            supports_tools = _provider_supports_tools(config)
            status = {
                "id": config.id,
                "name": config.name,
                "provider": config.provider,
                "model": config.model,
                "supports_tools": supports_tools,
                "tool_support_note": _get_tool_support_note(config),
            }
            support_status.append(status)

        return {"configurations": support_status}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tool support status: {str(e)}")


def _get_tool_support_note(ai_config: AIConfig) -> str:
    """Get a human-readable note about tool calling support for this configuration."""
    provider = ai_config.provider.lower()
    # model check could be added here for future fine-grained support

    if provider in ["openai", "anthropic"]:
        return "✅ Full tool calling support"

    if provider == "gemini":
        try:
            # Check if required dependencies are available
            import google.genai  # noqa: F401
            from fastmcp import Client  # noqa: F401

            return "✅ Native MCP support via FastMCP"
        except ImportError:
            return "❌ Requires 'google-genai' and 'fastmcp' packages for MCP support"

    if provider == "ollama":
        return "⚠️ Not all Ollama models support tool calling!"

    return "❌ Tool calling not supported for this provider"


@router.post("/chat/stream")
async def stream_chat_with_ai(chat_request: ChatRequest, db: Session = Depends(get_db)):
    """Stream AI chat responses for real-time communication."""

    async def generate_stream():
        try:
            # Get AI configuration
            if chat_request.ai_config_id:
                ai_config = db.query(AIConfig).filter(AIConfig.id == chat_request.ai_config_id).first()
            else:
                ai_config = db.query(AIConfig).filter(AIConfig.is_default.is_(True)).first()

            if not ai_config:
                yield f"data: {json.dumps({'error': 'No AI configuration found'})}\n\n"
                return

            # Ollama doesn't require API key, but other providers do
            if ai_config.provider.lower() != "ollama" and not ai_config.api_key_encrypted:
                yield f"data: {json.dumps({'error': 'AI configuration has no API key'})}\n\n"
                return

            # Decrypt API key (not needed for Ollama)
            api_key = None
            if ai_config.provider.lower() != "ollama" and ai_config.api_key_encrypted:
                api_key = encryption_service.decrypt(ai_config.api_key_encrypted)

            # Get available MCP tools (same as non-streaming)
            mcp_servers_status = await mcp_service.get_all_servers_status()
            available_tools = []

            for server in mcp_servers_status:
                # Only include tools from connected servers for reliability
                if server["status"] == "connected":
                    for tool in server["tools"]:
                        parameters = tool.get("parameters", {})
                        if not parameters or parameters == {}:
                            parameters = {"type": "object", "properties": {}, "required": []}

                        available_tools.append(
                            {
                                "type": "function",
                                "function": {
                                    "name": f"{server['name'].replace(' ', '_')}_{tool['name']}",
                                    "description": tool["description"],
                                    "parameters": parameters,
                                },
                            }
                        )

            # Prepare messages
            messages = []
            for msg in chat_request.conversation_history:
                messages.append({"role": msg.role, "content": msg.content})

            # Add current user message
            messages.append({"role": "user", "content": chat_request.message})

            # Check if provider supports tool calling for streaming
            filtered_tools = available_tools if _provider_supports_tools(ai_config) else []

            # Add system message about tool availability for streaming
            if available_tools and not filtered_tools:
                # Tools available but not supported by this provider
                no_tools_message = f"Note: MCP tools are available but not supported by {ai_config.provider} with model {ai_config.model}. Consider using OpenAI or Anthropic for tool calling."
                messages.insert(0, {"role": "system", "content": no_tools_message})

            # Stream based on provider
            if ai_config.provider == "anthropic":
                async for chunk in _stream_anthropic(ai_config, messages, filtered_tools, api_key):
                    yield f"data: {json.dumps(chunk)}\n\n"
            elif ai_config.provider == "openai":
                async for chunk in _stream_openai(ai_config, messages, filtered_tools, api_key):
                    yield f"data: {json.dumps(chunk)}\n\n"
            elif ai_config.provider == "ollama":
                async for chunk in _stream_ollama(ai_config, messages, filtered_tools):
                    yield f"data: {json.dumps(chunk)}\n\n"
            elif ai_config.provider == "gemini":
                async for chunk in _stream_gemini(ai_config, messages, filtered_tools, api_key):
                    yield f"data: {json.dumps(chunk)}\n\n"
            else:
                yield f"data: {json.dumps({'error': f'Streaming not supported for provider: {ai_config.provider}'})}\n\n"

            # Send completion signal
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': f'Streaming failed: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        },
    )


async def _stream_openai(ai_config: AIConfig, messages: List[Dict], available_tools: List[Dict], api_key: str):
    """Stream OpenAI responses with tool execution support."""
    client = openai.AsyncOpenAI(api_key=api_key, base_url=ai_config.api_endpoint if ai_config.api_endpoint else None)

    request_params = {
        "model": ai_config.model,
        "messages": messages,
        "temperature": ai_config.parameters.get("temperature", 0.7),
        "max_tokens": ai_config.parameters.get("max_tokens", 1000),
        "stream": True,
    }

    if available_tools:
        request_params["tools"] = available_tools

    try:
        # Track tool calls across chunks
        accumulated_tool_calls = {}
        current_content = ""

        stream = await client.chat.completions.create(**request_params)

        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                choice = chunk.choices[0]
                delta = choice.delta

                # Handle content
                if delta.content:
                    current_content += delta.content
                    yield {"type": "content", "content": delta.content}

                # Handle tool calls
                elif delta.tool_calls:
                    for tool_call in delta.tool_calls:
                        index = getattr(tool_call, "index", 0)

                        # Initialize or update accumulated tool call
                        if index not in accumulated_tool_calls:
                            accumulated_tool_calls[index] = {
                                "id": getattr(tool_call, "id", None),
                                "type": getattr(tool_call, "type", None),
                                "function": {"name": "", "arguments": ""},
                            }

                        # Update tool call data
                        if hasattr(tool_call, "id") and tool_call.id:
                            accumulated_tool_calls[index]["id"] = tool_call.id
                        if hasattr(tool_call, "type") and tool_call.type:
                            accumulated_tool_calls[index]["type"] = tool_call.type
                        if hasattr(tool_call, "function") and tool_call.function:
                            if hasattr(tool_call.function, "name") and tool_call.function.name:
                                accumulated_tool_calls[index]["function"]["name"] = tool_call.function.name
                            if hasattr(tool_call.function, "arguments") and tool_call.function.arguments:
                                accumulated_tool_calls[index]["function"]["arguments"] += tool_call.function.arguments

                # Check if stream is complete (finish_reason present)
                elif choice.finish_reason == "tool_calls" and accumulated_tool_calls:
                    # Execute all accumulated tool calls
                    for tool_call in accumulated_tool_calls.values():
                        if tool_call["function"]["name"]:
                            yield {"type": "tool_start", "tool_name": tool_call["function"]["name"]}

                            try:
                                # Parse tool parameters
                                import json

                                parameters = (
                                    json.loads(tool_call["function"]["arguments"])
                                    if tool_call["function"]["arguments"]
                                    else {}
                                )

                                # Parse tool name to get server and actual tool name
                                tool_name = tool_call["function"]["name"]
                                original_mapping = None

                                # Try to find server name by checking registered servers
                                mcp_servers_status = await mcp_service.get_all_servers_status()
                                for server in mcp_servers_status:
                                    server_prefix = server["name"].replace(" ", "_")
                                    if tool_name.startswith(server_prefix + "_"):
                                        server_name = server["name"]
                                        actual_tool_name = tool_name[len(server_prefix) + 1 :]
                                        original_mapping = (server_name, actual_tool_name)
                                        break

                                if not original_mapping:
                                    # Fallback parsing for backwards compatibility
                                    if tool_name.startswith("Hacker_News_"):
                                        server_name = "Hacker News"
                                        actual_tool_name = tool_name[len("Hacker_News_") :]
                                    else:
                                        server_name = "Unknown"
                                        actual_tool_name = tool_name
                                else:
                                    server_name, actual_tool_name = original_mapping

                                # Execute tool
                                logger.debug(
                                    f"OpenAI Streaming: Executing tool {actual_tool_name} on server {server_name}"
                                )
                                tool_result = await mcp_service.call_tool(server_name, actual_tool_name, parameters)

                                # Extract result text
                                if hasattr(tool_result, "content") and tool_result.content:
                                    if len(tool_result.content) > 0 and hasattr(tool_result.content[0], "text"):
                                        result_text = tool_result.content[0].text
                                    else:
                                        result_text = str(tool_result)
                                else:
                                    result_text = str(tool_result)

                                yield {"type": "tool_result", "tool_name": tool_name, "result": result_text}

                                # Add tool call and result to conversation for follow-up
                                messages.append(
                                    {
                                        "role": "assistant",
                                        "content": current_content,
                                        "tool_calls": [
                                            {
                                                "id": tool_call["id"],
                                                "type": "function",
                                                "function": {
                                                    "name": tool_name,
                                                    "arguments": tool_call["function"]["arguments"],
                                                },
                                            }
                                        ],
                                    }
                                )
                                messages.append(
                                    {"role": "tool", "content": result_text, "tool_call_id": tool_call["id"]}
                                )

                            except Exception as tool_error:
                                yield {"type": "tool_error", "tool_name": tool_name, "error": str(tool_error)}
                                return

                    # Continue conversation to get AI's response to tool results
                    follow_up_stream = await client.chat.completions.create(
                        model=ai_config.model,
                        messages=messages,
                        max_tokens=ai_config.parameters.get("max_tokens", 1000),
                        stream=True,
                        temperature=ai_config.parameters.get("temperature", 0.7),
                    )

                    async for follow_chunk in follow_up_stream:
                        if follow_chunk.choices and len(follow_chunk.choices) > 0:
                            follow_delta = follow_chunk.choices[0].delta
                            if follow_delta.content:
                                yield {"type": "content", "content": follow_delta.content}
                    return

    except Exception as e:
        yield {"error": f"OpenAI streaming error: {str(e)}"}


async def _stream_anthropic(ai_config: AIConfig, messages: List[Dict], available_tools: List[Dict], api_key: str):
    """Stream Anthropic responses with tool support."""
    client = anthropic.AsyncAnthropic(api_key=api_key)

    # Convert OpenAI-style tools to Anthropic format
    anthropic_tools = []
    for tool in available_tools:
        parameters = tool["function"].get("parameters", {})
        if not parameters or parameters == {}:
            input_schema = {"type": "object", "properties": {}, "required": []}
        else:
            input_schema = parameters

        anthropic_tools.append(
            {
                "name": tool["function"]["name"].replace(".", "_"),
                "description": tool["function"]["description"],
                "input_schema": input_schema,
            }
        )

    # Filter out messages with empty content for Anthropic (stricter validation than OpenAI)
    conversation_messages = []
    for msg in messages:
        # Skip messages with empty or whitespace-only content
        if msg.get("content") and str(msg["content"]).strip():
            conversation_messages.append(msg)
        elif msg.get("role") == "assistant" and len(messages) > 0 and msg == messages[-1]:
            # Allow empty final assistant message as per Anthropic rules
            conversation_messages.append(msg)

    while True:
        request_params = {
            "model": ai_config.model,
            "messages": conversation_messages,
            "max_tokens": ai_config.parameters.get("max_tokens", 1000),
            "temperature": ai_config.parameters.get("temperature", 0.7),
        }

        if anthropic_tools:
            request_params["tools"] = anthropic_tools
            system_message = f"You have access to the following MCP tools: {[tool['function']['name'] for tool in available_tools]}. Use them when helpful to answer user questions."
            request_params["system"] = system_message

        try:
            # Track content blocks and tool calls
            content_blocks = {}
            current_text = ""
            tool_executed = False

            async with client.messages.stream(**request_params) as stream:
                async for event in stream:
                    if event.type == "content_block_start":
                        if event.content_block.type == "text":
                            content_blocks[event.index] = {"type": "text", "content": ""}
                        elif event.content_block.type == "tool_use":
                            content_blocks[event.index] = {
                                "type": "tool_use",
                                "id": event.content_block.id,
                                "name": event.content_block.name,
                                "input": "",
                            }

                    elif event.type == "content_block_delta":
                        if event.delta.type == "text_delta":
                            # Stream text content to user
                            if event.index in content_blocks:
                                content_blocks[event.index]["content"] += event.delta.text
                            current_text += event.delta.text
                            yield {"type": "content", "content": event.delta.text}
                        elif event.delta.type == "input_json_delta":
                            # Accumulate tool input JSON
                            if event.index in content_blocks:
                                content_blocks[event.index]["input"] += event.delta.partial_json

                    elif event.type == "content_block_stop":
                        # Process completed content blocks
                        if event.index in content_blocks:
                            block = content_blocks[event.index]
                            if block["type"] == "tool_use":
                                # Tool call completed, execute it
                                yield {"type": "tool_start", "tool_name": block["name"]}

                                try:
                                    # Parse tool parameters
                                    import json

                                    parameters = json.loads(block["input"]) if block["input"] else {}

                                    # Parse tool name to get server and actual tool name
                                    original_mapping = None
                                    # Try to find server name by checking registered servers
                                    mcp_servers_status = await mcp_service.get_all_servers_status()
                                    for server in mcp_servers_status:
                                        server_prefix = server["name"].replace(" ", "_")
                                        if block["name"].startswith(server_prefix + "_"):
                                            server_name = server["name"]
                                            actual_tool_name = block["name"][len(server_prefix) + 1 :]
                                            original_mapping = (server_name, actual_tool_name)
                                            break

                                    if not original_mapping:
                                        # Fallback parsing for backwards compatibility
                                        if block["name"].startswith("Hacker_News_"):
                                            server_name = "Hacker News"
                                            actual_tool_name = block["name"][len("Hacker_News_") :]
                                        else:
                                            server_name = "Unknown"
                                            actual_tool_name = block["name"]
                                    else:
                                        server_name, actual_tool_name = original_mapping

                                    # Execute tool
                                    logger.debug(
                                        f"Streaming: Executing tool {actual_tool_name} on server {server_name}"
                                    )
                                    tool_result = await mcp_service.call_tool(server_name, actual_tool_name, parameters)

                                    # Extract result text
                                    if hasattr(tool_result, "content") and tool_result.content:
                                        if len(tool_result.content) > 0 and hasattr(tool_result.content[0], "text"):
                                            result_text = tool_result.content[0].text
                                        else:
                                            result_text = str(tool_result)
                                    else:
                                        result_text = str(tool_result)

                                    # Add tool result to conversation
                                    # Build assistant content, avoiding empty text blocks
                                    assistant_content = []
                                    if current_text and current_text.strip():
                                        assistant_content.append({"type": "text", "text": current_text.strip()})
                                    assistant_content.append(
                                        {
                                            "type": "tool_use",
                                            "id": block["id"],
                                            "name": block["name"],
                                            "input": parameters,
                                        }
                                    )

                                    conversation_messages.append({"role": "assistant", "content": assistant_content})
                                    conversation_messages.append(
                                        {
                                            "role": "user",
                                            "content": [
                                                {
                                                    "type": "tool_result",
                                                    "tool_use_id": block["id"],
                                                    "content": result_text,
                                                }
                                            ],
                                        }
                                    )

                                    yield {"type": "tool_result", "tool_name": block["name"], "result": result_text}
                                    tool_executed = True

                                    # Continue conversation to get AI's response to tool result
                                    break  # Break out of event loop to restart conversation

                                except Exception as tool_error:
                                    yield {"type": "tool_error", "tool_name": block["name"], "error": str(tool_error)}
                                    return

                    elif event.type == "message_stop":
                        # Message completed
                        return

                # If no tool was executed, we're done
                if not tool_executed:
                    break

        except Exception as e:
            yield {"error": f"Anthropic streaming error: {str(e)}"}


async def _stream_ollama(ai_config: AIConfig, messages: List[Dict], available_tools: List[Dict]):
    """Stream Ollama responses using the official Ollama Python library."""
    try:
        # Create Ollama client with custom host if specified
        from ollama import AsyncClient

        client_kwargs = {}
        if ai_config.api_endpoint:
            client_kwargs["host"] = ai_config.api_endpoint

        client = AsyncClient(**client_kwargs)

        # Convert messages to Ollama format
        ollama_messages = []
        for msg in messages:
            ollama_messages.append({"role": msg["role"], "content": msg["content"]})

        # Prepare request parameters
        request_params = {"model": ai_config.model, "messages": ollama_messages, "stream": True}

        # Add options from ai_config.parameters if available
        if ai_config.parameters:
            options = {}
            if "temperature" in ai_config.parameters:
                options["temperature"] = ai_config.parameters["temperature"]
            if "max_tokens" in ai_config.parameters:
                options["num_predict"] = ai_config.parameters["max_tokens"]  # Ollama uses num_predict
            if options:
                request_params["options"] = options

        # Debug logging for Ollama streaming request
        logger.debug(
            f"Ollama Streaming Request - Model: {ai_config.model}, Messages: {ollama_messages}, Parameters: {request_params}"
        )

        # Make the streaming chat request
        async for chunk in await client.chat(**request_params):
            # Debug logging for each chunk
            logger.debug(f"Ollama Streaming Chunk: {chunk}")

            # Extract content from the chunk
            if "message" in chunk and "content" in chunk["message"]:
                content = chunk["message"]["content"]
                if content:  # Only yield non-empty content
                    yield {"type": "content", "content": content}

            # Check if streaming is done
            if chunk.get("done", False):
                break

    except Exception as e:
        logger.error(f"Ollama streaming error: {str(e)}")
        yield {"error": f"Ollama streaming error: {str(e)}"}


async def _call_gemini(
    api_key: str, ai_config: AIConfig, messages: List[Dict], available_tools: List[Dict]
) -> tuple[str, List[Dict]]:
    """Call Google Gemini API with native MCP support via FastMCP client session."""
    try:
        tools_used = []

        # If no tools available, use direct Gemini API
        if not available_tools:
            return await _call_gemini_direct(api_key, ai_config, messages)

        # Use native Gemini MCP integration via FastMCP client
        # Import here to avoid import errors if google-genai is not installed
        from google import genai

        # Initialize Gemini client
        gemini_client = genai.Client(api_key=api_key)

        # Convert messages to content format for Gemini
        content_messages = []
        for msg in messages:
            if msg["role"] == "user":
                content_messages.append(msg["content"])
            elif msg["role"] == "assistant":
                content_messages.append(f"Assistant: {msg['content']}")
            elif msg["role"] == "system":
                content_messages.insert(0, f"System: {msg['content']}")

        # Combine into single content string
        content = "\n".join(content_messages)

        # Create a temporary FastMCP client configuration for our MCP servers
        # We'll create a multi-server config that includes all connected servers
        mcp_servers_status = await mcp_service.get_all_servers_status()

        # Build MCP server configuration for FastMCP client
        mcp_config = {"mcpServers": {}}
        for server in mcp_servers_status:
            if server["status"] == "connected" and server["name"] in mcp_service.server_configs:
                server_config = mcp_service.server_configs[server["name"]]
                mcp_config["mcpServers"][server["name"]] = server_config["config"]

        # Enhanced debug logging for Gemini MCP
        logger.debug("=" * 80)
        logger.debug(f"🤖 GEMINI MCP REQUEST - Model: {ai_config.model}")
        logger.debug(f"📨 MCP Config: {json.dumps(mcp_config, indent=2)}")
        logger.debug(f"💬 Content: {content[:200]}{'...' if len(content) > 200 else ''}")
        logger.debug("=" * 80)

        if not mcp_config["mcpServers"]:
            # No connected servers, fall back to direct API
            logger.debug("⚠️ No connected MCP servers for Gemini, falling back to direct API")
            return await _call_gemini_direct(api_key, ai_config, messages)

        # Create FastMCP client for Gemini integration
        try:
            from fastmcp import Client

            mcp_client = Client(mcp_config)

            # Use Gemini's native MCP integration
            async with mcp_client:
                start_time = time.time()
                response = await gemini_client.aio.models.generate_content(
                    model=ai_config.model,
                    contents=content,
                    config=genai.types.GenerateContentConfig(
                        temperature=ai_config.parameters.get("temperature", 0.7),
                        max_output_tokens=ai_config.parameters.get("max_tokens", 1000),
                        tools=[mcp_client.session],  # Pass FastMCP client session to Gemini
                    ),
                )
                end_time = time.time()

                # Enhanced debug logging for Gemini MCP response
                logger.debug("=" * 80)
                logger.debug(f"🤖 GEMINI MCP RESPONSE - Model: {ai_config.model} (took {end_time - start_time:.2f}s)")
                logger.debug(f"📥 Response Text: {response.text[:500]}{'...' if len(response.text) > 500 else ''}")
                logger.debug(f"🔧 Native MCP Integration: Tools handled automatically by Gemini")
                logger.debug("=" * 80)

                # Extract tools used (this is handled automatically by Gemini's MCP integration)
                # We'll indicate that MCP tools were available
                if hasattr(response, "candidates") and response.candidates:
                    # Check if any tool calls were made (Gemini handles this internally)
                    tools_used.append(
                        {"note": "Gemini's native MCP integration was used - tool calls handled automatically"}
                    )

                return response.text, tools_used

        except ImportError:
            logger.error("FastMCP not available for Gemini MCP integration, falling back to direct API")
            return await _call_gemini_direct(api_key, ai_config, messages)
        except Exception as e:
            logger.error(f"Gemini MCP integration failed: {e}, falling back to direct API")
            return await _call_gemini_direct(api_key, ai_config, messages)

    except Exception as e:
        logger.error(f"Gemini API call failed: {str(e)}")
        raise Exception(f"Gemini API call failed: {str(e)}")


async def _call_gemini_direct(api_key: str, ai_config: AIConfig, messages: List[Dict]) -> tuple[str, List[Dict]]:
    """Call Google Gemini API directly without MCP support."""
    try:
        # Initialize Gemini client
        from google import genai

        client = genai.Client(api_key=api_key)

        # Convert messages to Gemini format
        gemini_messages = []
        system_instruction = None

        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            elif msg["role"] == "user":
                gemini_messages.append({"role": "user", "parts": [{"text": msg["content"]}]})
            elif msg["role"] == "assistant":
                gemini_messages.append({"role": "model", "parts": [{"text": msg["content"]}]})

        # Configure generation settings
        config_params = {
            "temperature": ai_config.parameters.get("temperature", 0.7),
            "max_output_tokens": ai_config.parameters.get("max_tokens", 1000),
        }

        if system_instruction:
            config_params["system_instruction"] = system_instruction

        # Enhanced debug logging for Gemini direct request
        logger.debug("=" * 80)
        logger.debug(f"🤖 GEMINI DIRECT REQUEST - Model: {ai_config.model}")
        logger.debug(f"📨 Config Parameters: {json.dumps(config_params, indent=2)}")
        logger.debug(f"💬 Messages ({len(gemini_messages)} total):")
        for i, msg in enumerate(gemini_messages):
            logger.debug(
                f"  [{i}] {msg['role']}: {str(msg['parts'])[:200]}{'...' if len(str(msg['parts'])) > 200 else ''}"
            )
        logger.debug("=" * 80)

        # Make the request
        start_time = time.time()
        response = client.models.generate_content(
            model=ai_config.model, contents=gemini_messages, config=genai.types.GenerateContentConfig(**config_params)
        )
        end_time = time.time()

        # Enhanced debug logging for Gemini direct response
        logger.debug("=" * 80)
        logger.debug(f"🤖 GEMINI DIRECT RESPONSE - Model: {ai_config.model} (took {end_time - start_time:.2f}s)")
        logger.debug(f"📥 Response Text: {response.text[:500]}{'...' if len(response.text) > 500 else ''}")
        logger.debug("=" * 80)

        return response.text, []

    except Exception as e:
        logger.error(f"Gemini direct API call failed: {str(e)}")
        raise Exception(f"Gemini direct API call failed: {str(e)}")


async def _stream_gemini(ai_config: AIConfig, messages: List[Dict], available_tools: List[Dict], api_key: str):
    """Stream Gemini responses with native MCP support when available."""
    try:
        # Initialize Gemini client
        from google import genai

        gemini_client = genai.Client(api_key=api_key)

        # If no tools available or FastMCP not available, use direct streaming
        if not available_tools:
            async for chunk in _stream_gemini_direct(gemini_client, ai_config, messages):
                yield chunk
            return

        # Try native MCP integration for streaming
        try:
            from fastmcp import Client

            # Create MCP client configuration
            mcp_servers_status = await mcp_service.get_all_servers_status()
            mcp_config = {"mcpServers": {}}

            for server in mcp_servers_status:
                if server["status"] == "connected" and server["name"] in mcp_service.server_configs:
                    server_config = mcp_service.server_configs[server["name"]]
                    mcp_config["mcpServers"][server["name"]] = server_config["config"]

            if not mcp_config["mcpServers"]:
                # No connected servers, fall back to direct streaming
                async for chunk in _stream_gemini_direct(gemini_client, ai_config, messages):
                    yield chunk
                return

            # Convert messages to content format for Gemini
            content_messages = []
            for msg in messages:
                if msg["role"] == "user":
                    content_messages.append(msg["content"])
                elif msg["role"] == "assistant":
                    content_messages.append(f"Assistant: {msg['content']}")
                elif msg["role"] == "system":
                    content_messages.insert(0, f"System: {msg['content']}")

            content = "\n".join(content_messages)

            # Create FastMCP client for streaming
            mcp_client = Client(mcp_config)

            # Use Gemini's native MCP integration for streaming
            async with mcp_client:
                # Note: Gemini's MCP streaming may not be fully supported yet
                # Fall back to non-streaming if streaming fails
                try:
                    # For now, use non-streaming with MCP and yield the result
                    response = await gemini_client.aio.models.generate_content(
                        model=ai_config.model,
                        contents=content,
                        config=genai.types.GenerateContentConfig(
                            temperature=ai_config.parameters.get("temperature", 0.7),
                            max_output_tokens=ai_config.parameters.get("max_tokens", 1000),
                            tools=[mcp_client.session],  # Pass FastMCP client session
                        ),
                    )

                    # Yield the full response (since streaming with MCP may not be supported)
                    if response.text:
                        yield {"type": "content", "content": response.text}

                except Exception as mcp_stream_error:
                    logger.warning(f"Gemini MCP streaming failed: {mcp_stream_error}, falling back to direct streaming")
                    async for chunk in _stream_gemini_direct(gemini_client, ai_config, messages):
                        yield chunk

        except ImportError:
            logger.info("FastMCP not available for Gemini streaming, using direct streaming")
            async for chunk in _stream_gemini_direct(gemini_client, ai_config, messages):
                yield chunk

    except Exception as e:
        logger.error(f"Gemini streaming error: {str(e)}")
        yield {"error": f"Gemini streaming error: {str(e)}"}


async def _stream_gemini_direct(gemini_client, ai_config: AIConfig, messages: List[Dict]):
    """Stream Gemini responses directly without MCP support."""
    try:
        # Convert messages to Gemini format
        gemini_messages = []
        system_instruction = None

        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            elif msg["role"] == "user":
                gemini_messages.append({"role": "user", "parts": [{"text": msg["content"]}]})
            elif msg["role"] == "assistant":
                gemini_messages.append({"role": "model", "parts": [{"text": msg["content"]}]})

        # Configure generation settings
        config_params = {
            "temperature": ai_config.parameters.get("temperature", 0.7),
            "max_output_tokens": ai_config.parameters.get("max_tokens", 1000),
        }

        if system_instruction:
            config_params["system_instruction"] = system_instruction

        # Debug logging for Gemini direct streaming request
        logger.debug(f"Gemini Direct Streaming Request - Model: {ai_config.model}, Messages: {gemini_messages}")

        from google.genai import types

        # Stream the response
        for chunk in gemini_client.models.generate_content_stream(
            model=ai_config.model, contents=gemini_messages, config=types.GenerateContentConfig(**config_params)
        ):
            if chunk.text:
                logger.debug(f"Gemini Direct Streaming Chunk: {chunk.text}")
                yield {"type": "content", "content": chunk.text}

    except Exception as e:
        logger.error(f"Gemini direct streaming error: {str(e)}")
        yield {"error": f"Gemini direct streaming error: {str(e)}"}


# Simple generation functions without tool calling


async def _simple_call_openai(api_key: str, ai_config: AIConfig, messages: List[Dict]) -> str:
    """Call OpenAI API without tool support."""
    client = openai.AsyncOpenAI(api_key=api_key, base_url=ai_config.api_endpoint if ai_config.api_endpoint else None)

    request_params = {
        "model": ai_config.model,
        "messages": messages,
        "temperature": ai_config.parameters.get("temperature", 0.7),
        "max_tokens": ai_config.parameters.get("max_tokens", 1000),
    }

    response = await client.chat.completions.create(**request_params)
    return response.choices[0].message.content or ""


async def _simple_call_anthropic(api_key: str, ai_config: AIConfig, messages: List[Dict]) -> str:
    """Call Anthropic API without tool support."""
    client = anthropic.AsyncAnthropic(
        api_key=api_key, base_url=ai_config.api_endpoint if ai_config.api_endpoint else None
    )

    # Separate system messages from user/assistant messages
    system_message = ""
    chat_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_message += msg["content"] + "\n"
        else:
            chat_messages.append({"role": msg["role"], "content": msg["content"]})

    request_params = {
        "model": ai_config.model,
        "max_tokens": ai_config.parameters.get("max_tokens", 1000),
        "messages": chat_messages,
    }

    if system_message:
        request_params["system"] = system_message.strip()

    if "temperature" in ai_config.parameters:
        request_params["temperature"] = ai_config.parameters["temperature"]

    response = await client.messages.create(**request_params)

    text_content = ""
    for block in response.content:
        if hasattr(block, "text"):
            text_content += block.text

    return text_content


async def _simple_call_ollama(ai_config: AIConfig, messages: List[Dict]) -> str:
    """Call Ollama API without tool support."""
    from ollama import AsyncClient

    client_kwargs = {}
    if ai_config.api_endpoint:
        client_kwargs["host"] = ai_config.api_endpoint

    client = AsyncClient(**client_kwargs)

    # Convert messages to Ollama format
    ollama_messages = []
    for msg in messages:
        ollama_messages.append({"role": msg["role"], "content": msg["content"]})

    # Prepare request parameters WITHOUT tools
    request_params = {"model": ai_config.model, "messages": ollama_messages}

    # Add options from ai_config.parameters if available
    if ai_config.parameters:
        options = {}
        if "temperature" in ai_config.parameters:
            options["temperature"] = ai_config.parameters["temperature"]
        if "max_tokens" in ai_config.parameters:
            options["num_predict"] = ai_config.parameters["max_tokens"]
        if options:
            request_params["options"] = options

    logger.debug(f"Simple Ollama request (no tools): {request_params}")

    response = await client.chat(**request_params)
    message = response.get("message", {})
    return message.get("content", "")


async def _simple_call_gemini(api_key: str, ai_config: AIConfig, messages: List[Dict]) -> str:
    """Call Gemini API without tool support."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)

    # Convert messages to Gemini format
    content_messages = []
    for msg in messages:
        if msg["role"] == "user":
            content_messages.append(msg["content"])
        elif msg["role"] == "assistant":
            content_messages.append(f"Assistant: {msg['content']}")
        elif msg["role"] == "system":
            content_messages.insert(0, f"System: {msg['content']}")

    content = "\n".join(content_messages)

    model = genai.GenerativeModel(ai_config.model)
    response = await model.generate_content_async(
        content,
        generation_config=genai.types.GenerationConfig(
            temperature=ai_config.parameters.get("temperature", 0.7),
            max_output_tokens=ai_config.parameters.get("max_tokens", 1000),
        ),
    )

    return response.text

"""
AI Conversion Service for Widget Connections.
This service handles converting text data from one widget to structured data for another widget.
"""

import inspect
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

import anthropic
import openai
from sqlalchemy.orm import Session

from database import AIConfig, WidgetBlueprint
from services.encryption_service import EncryptionService


class AIConversionService:
    """Service for converting widget data using AI."""

    def __init__(self):
        self.encryption_service = EncryptionService()
        self.trace_id = None  # Will be set by the router

    def set_trace_id(self, trace_id: str):
        """Set the trace ID for logging throughout the service."""
        self.trace_id = trace_id

    def _log(self, message: str):
        """Log a message with trace ID and file location if available."""
        frame = inspect.currentframe().f_back
        filename = frame.f_code.co_filename.split("/")[-1]  # Get just the filename
        line_number = frame.f_lineno

        if self.trace_id:
            print(f"[TRACE:{self.trace_id}] [{filename}:{line_number}] {message}")
        else:
            print(f"[{filename}:{line_number}] {message}")

    def _truncate_for_log(self, data: Any, max_length: int = 500) -> str:
        """Truncate data for logging purposes."""
        if data is None:
            return "(none)"

        # Convert to string
        if isinstance(data, (dict, list)):
            data_str = json.dumps(data, indent=2)
        else:
            data_str = str(data)

        # Truncate if needed
        if len(data_str) <= max_length:
            return data_str

        return data_str[:max_length] + f"\n... (truncated, total length: {len(data_str)} chars)"

    async def convert_text_to_widget_data(
        self,
        text_data: str,
        target_widget_type: str,
        target_schema: Optional[Dict[str, Any]] = None,
        ai_config_id: Optional[int] = None,
        transformation_prompt: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Convert text data to structured data for a specific widget type using AI."""

        # Step 1: Apply transformation prompt if provided
        processed_text_data = text_data
        if transformation_prompt and ai_config_id and db:
            try:
                self._log(
                    f"   🔄 Applying transformation prompt: '{transformation_prompt[:50]}{'...' if len(transformation_prompt) > 50 else ''}'"
                )
                processed_text_data = await self._apply_transformation_prompt(
                    text_data, transformation_prompt, ai_config_id, db
                )
                self._log(
                    f"   ✅ Transformation applied. Original: {len(text_data)} chars → Transformed: {len(processed_text_data)} chars"
                )
            except Exception as e:
                self._log(f"   ⚠️  Transformation failed, using original data: {e}")
                # Continue with original data if transformation fails
                processed_text_data = text_data

        # Define simple text widgets that don't need AI conversion
        simple_text_widgets = {"sticky_note", "markdown_editor", "note_widget", "text_widget"}

        # Skip AI for simple text widgets - just use direct conversion
        if target_widget_type in simple_text_widgets:
            print(f"Skipping AI conversion for simple text widget: {target_widget_type}")
            # Use simple conversion directly
        # If we have AI config and schema, use AI conversion for structured data widgets
        elif ai_config_id and target_schema and db:
            try:
                return await self._convert_with_ai(
                    processed_text_data, target_widget_type, target_schema, ai_config_id, db
                )
            except Exception as e:
                print(f"AI conversion failed, falling back to simple conversion: {e}")
                # Fall back to simple conversion if AI fails

        # Fallback to simple conversion templates
        conversion_templates = {
            "table": self._convert_to_table,
            "todo_list": self._convert_to_todo,
            "kanban": self._convert_to_kanban,
            "data_widget": self._convert_to_data_widget,
            "sticky_note": self._convert_to_note,
            "markdown_editor": self._convert_to_markdown,
            "flash_card": self._convert_to_flashcard,
        }

        converter = conversion_templates.get(target_widget_type)
        if not converter:
            # Fallback to generic data widget conversion
            converter = self._convert_to_data_widget

        try:
            return await converter(processed_text_data, ai_config_id)
        except Exception as e:
            # TODO: Log error properly
            print(f"Simple conversion failed: {e}")
            # Return a fallback structure
            return self._get_fallback_data(target_widget_type, processed_text_data)

    async def _convert_with_ai(
        self, text_data: str, target_widget_type: str, target_schema: Dict[str, Any], ai_config_id: int, db: Session
    ) -> Dict[str, Any]:
        """Convert text data using AI with target widget schema."""

        # Get AI configuration
        ai_config = db.query(AIConfig).filter(AIConfig.id == ai_config_id).first()
        if not ai_config:
            raise Exception("AI configuration not found")

        # Ollama doesn't require API key, but other providers do
        if ai_config.provider.lower() != "ollama" and not ai_config.api_key_encrypted:
            raise Exception("Invalid AI configuration: missing API key")

        # Decrypt API key (not needed for Ollama)
        api_key = None
        if ai_config.provider.lower() != "ollama" and ai_config.api_key_encrypted:
            api_key = self.encryption_service.decrypt(ai_config.api_key_encrypted)

        # Create AI prompt with source content and target schema
        system_prompt = f"""You are a data conversion assistant. Convert the provided text content into structured JSON data according to the target widget schema.

Target Widget Type: {target_widget_type}
Target Widget Schema: {json.dumps(target_schema, indent=2)}

CRITICAL INSTRUCTIONS:
1. Parse the input text content carefully
2. Convert it to match the target widget's expected data structure
3. Return ONLY the actual content data, NOT the schema structure
4. For markdown/text widgets: put the text in the "content" field
5. For todo lists: create items array with actual tasks
6. For tables: create data array with actual rows
7. Return ONLY valid JSON, no explanations

CORRECT Example conversions:
- For Markdown Editor with field "content": {{"content": "# Summary\\n\\nActual text content here..."}}
- For todo_list: {{"items": [{{"id": "todo_1", "text": "Task 1", "completed": false, "createdAt": "2025-01-01T00:00:00"}}]}}
- For table: {{"data": [{{"id": "1", "name": "Item 1", "value": "Value 1", "category": "General"}}]}}
- For sticky_note: {{"text": "Content here", "fontSize": 14}}

WRONG - DO NOT return the schema:
- WRONG: {{"fields": [{{"id": "content", "name": "...", ...}}]}}
- CORRECT: {{"content": "actual text here"}}"""

        user_prompt = f"""Convert this text content to {target_widget_type} format:

{text_data}

Remember: Return the actual content data, NOT the schema structure!"""

        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]

        # Call AI based on provider
        self._log(f"   🤖 Calling AI provider: {ai_config.provider}")
        self._log(f"   📝 Model: {ai_config.model}")
        self._log(f"   📊 Input size: {len(text_data)} chars")
        self._log(f"   📋 Target widget type: {target_widget_type}")

        # Log the request body (truncated)
        self._log(f"   📤 AI Request Body (truncated):")
        request_body_preview = self._truncate_for_log(messages, max_length=800)
        # Indent each line for better readability
        for line in request_body_preview.split("\n"):
            self._log(f"      {line}")

        if ai_config.provider == "openai":
            response_content = await self._call_openai_for_conversion(api_key, ai_config, messages)
        elif ai_config.provider == "anthropic":
            response_content = await self._call_anthropic_for_conversion(api_key, ai_config, messages)
        elif ai_config.provider == "ollama":
            response_content = await self._call_ollama_for_conversion(ai_config, messages)
        elif ai_config.provider == "gemini":
            response_content = await self._call_gemini_for_conversion(api_key, ai_config, messages)
        else:
            raise Exception(f"Unsupported AI provider: {ai_config.provider}")

        self._log(f"   ✅ AI response received: {len(response_content)} chars")

        # Log the response body (truncated)
        self._log(f"   📥 AI Response Body (truncated):")
        response_preview = self._truncate_for_log(response_content, max_length=800)
        # Indent each line for better readability
        for line in response_preview.split("\n"):
            self._log(f"      {line}")

        # Parse AI response as JSON
        try:
            parsed_result = json.loads(response_content.strip())
            self._log(f"   ✅ JSON parsed successfully")
            self._log(f"   📦 Parsed data keys: {list(parsed_result.keys())}")
            # Show data size info
            json_size = len(json.dumps(parsed_result))
            self._log(f"   📏 Parsed data size: {json_size} bytes")
            return parsed_result
        except json.JSONDecodeError as e:
            self._log(f"   ❌ ERROR: AI returned invalid JSON")
            self._log(f"   ❌ JSON Error: {str(e)}")
            self._log(f"   ❌ Response content (first 500 chars): {response_content[:500]}")
            # Fall back to simple conversion
            raise Exception(f"AI returned invalid JSON: {e}")

    async def _call_openai_for_conversion(self, api_key: str, ai_config: AIConfig, messages: List[Dict]) -> str:
        """Call OpenAI for data conversion."""
        client = openai.AsyncOpenAI(
            api_key=api_key, base_url=ai_config.api_endpoint if ai_config.api_endpoint else None
        )

        response = await client.chat.completions.create(
            model=ai_config.model,
            messages=messages,
            temperature=ai_config.parameters.get("temperature", 0.1),  # Low temperature for structured output
            max_tokens=ai_config.parameters.get("max_tokens", 2000),
        )

        return response.choices[0].message.content

    async def _call_anthropic_for_conversion(self, api_key: str, ai_config: AIConfig, messages: List[Dict]) -> str:
        """Call Anthropic for data conversion."""
        client = anthropic.AsyncAnthropic(api_key=api_key)

        # Convert messages format for Anthropic
        system_message = ""
        anthropic_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                anthropic_messages.append({"role": msg["role"], "content": msg["content"]})

        response = await client.messages.create(
            model=ai_config.model,
            system=system_message,
            messages=anthropic_messages,
            temperature=ai_config.parameters.get("temperature", 0.1),
            max_tokens=ai_config.parameters.get("max_tokens", 2000),
        )

        # Extract text content
        text_content = ""
        for block in response.content:
            if block.type == "text":
                text_content += block.text

        return text_content

    async def _call_ollama_for_conversion(self, ai_config: AIConfig, messages: List[Dict]) -> str:
        """Call Ollama for data conversion using official Ollama Python library."""
        import ollama

        # Initialize Ollama client
        client = ollama.AsyncClient(host=ai_config.api_endpoint or "http://localhost:11434")

        response = await client.chat(
            model=ai_config.model,
            messages=messages,
            options={
                "temperature": ai_config.parameters.get("temperature", 0.1),
                "num_predict": ai_config.parameters.get("max_tokens", 2000),
            },
        )

        return response["message"]["content"]

    async def _call_gemini_for_conversion(self, api_key: str, ai_config: AIConfig, messages: List[Dict]) -> str:
        """Call Google Gemini for data conversion."""
        from google import genai
        from google.genai import types

        # Initialize Gemini client
        client = genai.Client(api_key=api_key)

        # Convert messages to Gemini format
        gemini_messages = []
        system_instruction = None

        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
                continue
            elif msg["role"] == "user":
                gemini_messages.append({"role": "user", "parts": [{"text": msg["content"]}]})
            elif msg["role"] == "assistant":
                gemini_messages.append({"role": "model", "parts": [{"text": msg["content"]}]})

        # Configure generation settings
        config_params = {
            "temperature": ai_config.parameters.get("temperature", 0.1),
            "max_output_tokens": ai_config.parameters.get("max_tokens", 2000),
        }

        if system_instruction:
            config_params["system_instruction"] = system_instruction

        # Make the request
        response = client.models.generate_content(
            model=ai_config.model, contents=gemini_messages, config=types.GenerateContentConfig(**config_params)
        )

        return response.text

    async def _apply_transformation_prompt(
        self, text_data: str, transformation_prompt: str, ai_config_id: int, db: Session
    ) -> str:
        """Apply a user-defined transformation prompt to the source text data."""

        # Check if text_data contains a URL that needs to be fetched
        # Frontend sends URLs wrapped in <url>...</url> tags from webpage widgets
        import re

        url_match = re.match(r"^<url>(.*?)</url>$", text_data.strip())

        actual_content = text_data
        if url_match:
            url = url_match.group(1)
            self._log(f"     🌐 Detected URL in transformation input: {url}")

            # Fetch webpage content
            try:
                from routers.widget_connections import convert_html_to_markdown, fetch_webpage_content

                self._log(f"     📡 Fetching webpage content from URL...")
                webpage_html = fetch_webpage_content(url)
                if webpage_html:
                    # Convert HTML to markdown for better AI processing
                    self._log(f"     ✅ Webpage fetched: {len(webpage_html)} chars HTML")
                    actual_content = convert_html_to_markdown(webpage_html)
                    self._log(f"     📝 Converted to markdown: {len(actual_content)} chars")
                    self._log(f"     📄 Content preview: {actual_content[:150]}...")
                else:
                    # Fallback to URL if fetch failed
                    self._log(f"     ❌ Failed to fetch webpage content")
                    actual_content = f"Website: {url}\n\nContent could not be fetched."
            except Exception as e:
                self._log(f"     ❌ Error fetching webpage for transformation: {e}")
                actual_content = f"Website: {url}\n\nError fetching content: {str(e)}"
        else:
            self._log(f"     📝 Using provided text data ({len(text_data)} chars)")

        # Get AI configuration
        ai_config = db.query(AIConfig).filter(AIConfig.id == ai_config_id).first()
        if not ai_config:
            raise Exception("AI configuration not found")

        # Ollama doesn't require API key, but other providers do
        if ai_config.provider.lower() != "ollama" and not ai_config.api_key_encrypted:
            raise Exception("Invalid AI configuration: missing API key")

        # Decrypt API key (not needed for Ollama)
        api_key = None
        if ai_config.provider.lower() != "ollama" and ai_config.api_key_encrypted:
            api_key = self.encryption_service.decrypt(ai_config.api_key_encrypted)

        # Create transformation prompt
        system_prompt = f"""You are a content transformation assistant. Apply the user's transformation request to the provided content.

Instructions:
1. Follow the user's transformation request exactly
2. Maintain the essence and important information from the original content
3. Return only the transformed content, no explanations or additional text
4. If the transformation request is unclear, make reasonable assumptions
5. Keep the output in a format that can be further processed (plain text or simple markup)

User's transformation request: {transformation_prompt}"""

        user_prompt = f"""Transform this content according to the request:

Original content:
{actual_content}

Apply the transformation: {transformation_prompt}"""

        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]

        # Log the transformation request
        self._log(f"     📤 Transformation AI Request Body (truncated):")
        request_body_preview = self._truncate_for_log(messages, max_length=800)
        for line in request_body_preview.split("\n"):
            self._log(f"        {line}")

        # Call AI based on provider
        if ai_config.provider == "openai":
            response_content = await self._call_openai_for_conversion(api_key, ai_config, messages)
        elif ai_config.provider == "anthropic":
            response_content = await self._call_anthropic_for_conversion(api_key, ai_config, messages)
        elif ai_config.provider == "ollama":
            response_content = await self._call_ollama_for_conversion(ai_config, messages)
        elif ai_config.provider == "gemini":
            response_content = await self._call_gemini_for_conversion(api_key, ai_config, messages)
        else:
            raise Exception(f"Unsupported AI provider: {ai_config.provider}")

        # Log the transformation response
        self._log(f"     📥 Transformation AI Response Body (truncated):")
        response_preview = self._truncate_for_log(response_content, max_length=800)
        for line in response_preview.split("\n"):
            self._log(f"        {line}")

        return response_content.strip()

    async def get_blueprint_for_widget_type(self, widget_type: str, db: Session) -> Optional[WidgetBlueprint]:
        """Get the appropriate blueprint for a widget type."""

        # First, try to find blueprint by exact name match (handles new Universal Widget System)
        direct_match = db.query(WidgetBlueprint).filter(WidgetBlueprint.name == widget_type).first()

        if direct_match:
            return direct_match

        # Map legacy widget types to blueprint names for backward compatibility
        type_to_blueprint = {
            "table": "Data Table",
            "todo_list": "To-Do List",
            "kanban": "Kanban Board",
            "data_widget": "Data Table",  # Use Data Table for generic data widgets
            "sticky_note": "Sticky Note",
            "markdown_editor": "Markdown Editor",
            "flash_card": "Flash Cards",
        }

        # Try legacy mapping
        blueprint_name = type_to_blueprint.get(widget_type)
        if blueprint_name:
            return db.query(WidgetBlueprint).filter(WidgetBlueprint.name == blueprint_name).first()

        # Try with underscores converted to spaces
        normalized_name = widget_type.replace("_", " ").title()
        return db.query(WidgetBlueprint).filter(WidgetBlueprint.name.ilike(f"%{normalized_name}%")).first()

    async def _convert_to_table(self, text_data: str, ai_config_id: Optional[int] = None) -> Dict[str, Any]:
        """Convert text to table format."""
        # Try to parse the text as structured data
        lines = text_data.strip().split("\n")
        if len(lines) < 2:
            # Single line - create a simple table
            return {"data": [{"item": text_data, "category": "General", "notes": ""}]}

        # Multiple lines - try to create a table
        data = []
        for i, line in enumerate(lines[:10]):  # Limit to 10 rows
            if line.strip():
                data.append({"id": str(i + 1), "content": line.strip(), "category": "Imported", "status": "Active"})

        return {"data": data}

    async def _convert_to_todo(self, text_data: str, ai_config_id: Optional[int] = None) -> Dict[str, Any]:
        """Convert text to todo list format."""
        lines = text_data.strip().split("\n")
        items = []

        for i, line in enumerate(lines):
            if line.strip():
                # Check if line starts with checkbox indicators
                is_completed = line.strip().startswith(("☑", "✓", "[x]", "[X]"))
                clean_text = line.strip()

                # Remove checkbox indicators
                for indicator in ["☑", "✓", "[x]", "[X]", "☐", "[ ]", "-", "*"]:
                    if clean_text.startswith(indicator):
                        clean_text = clean_text[len(indicator) :].strip()
                        break

                if clean_text:
                    items.append(
                        {
                            "id": f"todo_{i}",
                            "text": clean_text,
                            "completed": is_completed,
                            "createdAt": datetime.now().isoformat(),
                        }
                    )

        return {"items": items}

    async def _convert_to_kanban(self, text_data: str, ai_config_id: Optional[int] = None) -> Dict[str, Any]:
        """Convert text to kanban board format."""
        lines = text_data.strip().split("\n")

        # Create columns
        columns = [
            {"id": "todo", "title": "To Do", "cards": []},
            {"id": "inprogress", "title": "In Progress", "cards": []},
            {"id": "done", "title": "Done", "cards": []},
        ]

        # Add items to To Do column
        for i, line in enumerate(lines):
            if line.strip():
                columns[0]["cards"].append(
                    {"id": f"card_{i}", "title": line.strip(), "description": "", "labels": ["imported"]}
                )

        return {"columns": columns}

    async def _convert_to_data_widget(self, text_data: str, ai_config_id: Optional[int] = None) -> Dict[str, Any]:
        """Convert text to generic data widget format."""
        lines = text_data.strip().split("\n")
        data = []

        for i, line in enumerate(lines):
            if line.strip():
                # Try to detect key-value pairs
                if ":" in line:
                    parts = line.split(":", 1)
                    data.append({"id": str(i), "key": parts[0].strip(), "value": parts[1].strip(), "type": "text"})
                else:
                    data.append({"id": str(i), "name": line.strip(), "value": "", "category": "General"})

        return {"data": data}

    async def _convert_to_note(self, text_data: str, ai_config_id: Optional[int] = None) -> Dict[str, Any]:
        """Convert text to sticky note format."""
        # Unescape literal \n sequences to actual newlines
        # This handles cases where markdown content has been escaped
        processed_text = text_data.replace("\\n", "\n").replace("\\t", "\t")

        return {"text": processed_text, "fontSize": 14}

    async def _convert_to_markdown(self, text_data: str, ai_config_id: Optional[int] = None) -> Dict[str, Any]:
        """Convert text to markdown format."""
        # Unescape literal \n sequences to actual newlines
        processed_text = text_data.replace("\\n", "\n").replace("\\t", "\t")

        return {"content": processed_text}

    async def _convert_to_flashcard(self, text_data: str, ai_config_id: Optional[int] = None) -> Dict[str, Any]:
        """Convert text to flashcard format."""
        lines = text_data.strip().split("\n")
        cards = []

        current_front = ""
        current_back = ""

        for line in lines:
            if line.strip():
                if not current_front:
                    current_front = line.strip()
                elif not current_back:
                    current_back = line.strip()
                    # Create card when we have both front and back
                    cards.append({"id": f"card_{len(cards)}", "front": current_front, "back": current_back})
                    current_front = ""
                    current_back = ""

        # Handle case where last card only has front
        if current_front and not current_back:
            cards.append({"id": f"card_{len(cards)}", "front": current_front, "back": "..."})

        return {"cards": cards, "currentIndex": 0}

    def _get_fallback_data(self, widget_type: str, text_data: str) -> Dict[str, Any]:
        """Return fallback data when AI conversion fails."""
        fallback_data = {
            "table": {"data": [{"content": text_data, "category": "Imported"}]},
            "todo_list": {"items": [{"id": "1", "text": text_data, "completed": False}]},
            "kanban": {"columns": [{"id": "todo", "title": "To Do", "cards": [{"id": "1", "title": text_data}]}]},
            "data_widget": {"data": [{"name": "Imported Text", "value": text_data}]},
            "sticky_note": {"text": text_data},
            "markdown_editor": {"content": text_data},
            "flash_card": {"cards": [{"id": "1", "front": text_data, "back": "..."}], "currentIndex": 0},
        }

        return fallback_data.get(widget_type, {"text": text_data})

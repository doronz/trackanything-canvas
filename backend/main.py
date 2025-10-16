"""
Main FastAPI application for Canvas MCP Client.
This module sets up the FastAPI app with all routes, middleware, and configurations.
"""

import logging
import os
import traceback
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from database import Base, MCPServer, engine, get_db
from migrations import run_migrations
from routers import (
    ai_chat,
    ai_configs,
    dashboards,
    mcp_directory,
    mcp_registry,
    mcp_servers,
    webpage,
    widget_blueprints,
    widget_connections,
    widgets,
)
from services.mcp_service import mcp_service

# Load environment variables
load_dotenv()

# Configure logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)

# Ensure uvicorn logs are also at the same level
logging.getLogger("uvicorn").setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
logging.getLogger("uvicorn.error").setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
logging.getLogger("uvicorn.access").setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

# Enable debug logging for FastAPI and pydantic validation errors
logging.getLogger("fastapi").setLevel(logging.DEBUG)
logging.getLogger("pydantic").setLevel(logging.DEBUG)

logger = logging.getLogger(__name__)
logger.info(f"Starting Canvas MCP Client API with log level: {LOG_LEVEL}")

# Run database migrations
logger.info("Running database migrations...")
if not run_migrations():
    logger.error("Failed to run database migrations!")
    # Fall back to create_all for development
    logger.warning("Falling back to create_all() for development")
    Base.metadata.create_all(bind=engine)
else:
    logger.info("✅ Database migrations completed successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting up Canvas MCP Client API...")
    try:
        # Get database session
        db = next(get_db())

        # Load all MCP servers from database
        servers = db.query(MCPServer).all()
        logger.info(f"Loading {len(servers)} MCP servers from database...")

        for server in servers:
            try:
                logger.debug(f"Loading MCP server: {server.name} (transport: {server.transport})")

                # Add server to MCP service
                await mcp_service.add_server(name=server.name, transport=server.transport, config=server.config)
                logger.info(f"Successfully loaded MCP server: {server.name}")

            except Exception as e:
                logger.error(f"Failed to load MCP server {server.name}: {e}")

        db.close()
        logger.info("MCP servers loaded successfully!")

    except Exception as e:
        logger.error(f"Failed to load MCP servers: {e}")

    yield

    # Shutdown
    logger.info("Shutting down Canvas MCP Client API...")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Canvas MCP Client API",
    description="Backend API for Canvas MCP Client - a customizable dashboard application with MCP server integration",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS - must be added early to handle preflight requests
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Request/Response logging middleware for debugging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests and responses for debugging."""
    logger.debug(f"Incoming request: {request.method} {request.url}")
    logger.debug(f"Request headers: {dict(request.headers)}")

    # Try to log request body if it exists and is not too large
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.body()
            if len(body) < 10000:  # Only log if less than 10KB
                logger.debug(f"Request body: {body.decode('utf-8')[:500]}")  # First 500 chars
            # Important: Store the body so it can be read again by the endpoint
            request._body = body
        except Exception as e:
            logger.debug(f"Could not log request body: {e}")

    response = await call_next(request)
    logger.debug(f"Response status: {response.status_code}")
    return response


# Validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed logging."""
    logger.error(f"Validation error at {request.url}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Validation errors: {exc.errors()}")

    # Try to log the request body for debugging
    try:
        body = await request.body()
        logger.error(f"Request body that failed validation: {body.decode('utf-8')}")
    except Exception as e:
        logger.error(f"Could not read request body: {e}")

    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": exc.body if hasattr(exc, "body") else None,
            "path": str(request.url),
            "method": request.method,
        },
    )


# Pydantic validation error handler
@app.exception_handler(ValidationError)
async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
    """Handle Pydantic validation errors with detailed logging."""
    logger.error(f"Pydantic validation error at {request.url}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Validation errors: {exc.errors()}")

    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "path": str(request.url),
            "method": request.method,
        },
    )


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to log all unhandled exceptions."""
    logger.error(f"Unhandled exception at {request.url}: {str(exc)}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Request headers: {dict(request.headers)}")
    logger.error(f"Traceback: {traceback.format_exc()}")

    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}", "path": str(request.url), "method": request.method},
    )


# Include routers
app.include_router(dashboards.router, prefix="/api/dashboards", tags=["dashboards"])
app.include_router(widgets.router, prefix="/api/widgets", tags=["widgets"])
app.include_router(widget_connections.router, prefix="/api/widget-connections", tags=["widget-connections"])
app.include_router(mcp_servers.router, prefix="/api/mcp-servers", tags=["mcp-servers"])
app.include_router(mcp_directory.router, prefix="/api/mcp-directory", tags=["mcp-directory"])
app.include_router(mcp_registry.router, prefix="/api/mcp-registry", tags=["mcp-registry"])
app.include_router(ai_configs.router, prefix="/api/ai-configs", tags=["ai-configs"])
app.include_router(ai_chat.router, prefix="/api/ai", tags=["ai-chat"])
app.include_router(widget_blueprints.router)
app.include_router(webpage.router)

# Mount static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    """Root endpoint returning API information."""
    return {"message": "Canvas MCP Client API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

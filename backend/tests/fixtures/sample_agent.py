"""Realistic sample agent with tool call patterns for testing the validator."""

SAMPLE_AGENT_CODE = '''
import os
import json
from typing import Any

# This is a realistic AI agent that uses various tools
# It demonstrates different tool call patterns for testing


def process_user_request(user_input: str, context: dict[str, Any]) -> str:
    """Process a user request by calling various tools."""
    # Extract intent
    intent = classify_intent(user_input)

    if intent == "search":
        # Search the knowledge base
        results = search_knowledge_base(query=user_input)
        return format_search_results(results)

    elif intent == "create_document":
        # Create a new document
        doc_id = create_document(
            title=context.get("title", "Untitled"),
            content=user_input,
            author=context.get("user", "anonymous"),
        )
        return f"Document created with ID: {doc_id}"

    elif intent == "send_email":
        # Send an email
        recipient = extract_recipient(user_input)
        subject = extract_subject(user_input)
        result = send_email(
            to=recipient,
            subject=subject,
            body=user_input,
        )
        return f"Email sent to {recipient}"

    elif intent == "process_payment":
        # Process a financial transaction
        amount = extract_amount(user_input)
        currency = extract_currency(user_input)
        result = process_payment(
            amount=amount,
            currency=currency,
            description=context.get("description", ""),
        )
        return f"Payment of {amount} {currency} processed"

    elif intent == "delete_resource":
        # Delete a resource
        resource_id = extract_resource_id(user_input)
        result = delete_resource(resource_id=resource_id, permanent=True)
        return f"Resource {resource_id} deleted"

    elif intent == "list_users":
        # List all users (admin operation)
        users = list_users(include_inactive=True, detailed=True)
        return format_user_list(users)

    elif intent == "read_file":
        # Read a file
        file_path = extract_file_path(user_input)
        content = read_file(file_path=file_path)
        return content

    elif intent == "update_config":
        # Update system configuration
        config_key = extract_config_key(user_input)
        config_value = extract_config_value(user_input)
        update_configuration(key=config_key, value=config_value)
        return f"Configuration {config_key} updated"

    else:
        # Fallback to general knowledge
        response = query_knowledge_base(query=user_input)
        return format_response(response)


# Helper functions (not tool calls, but called by the main handler)
def classify_intent(text: str) -> str:
    """Classify the user intent."""
    intents = ["search", "create_document", "send_email", "process_payment",
               "delete_resource", "list_users", "read_file", "update_config"]
    # Simple keyword matching
    for intent in intents:
        if intent.replace("_", " ") in text.lower():
            return intent
    return "search"


def extract_recipient(text: str) -> str:
    """Extract email recipient from text."""
    return "user@example.com"


def extract_subject(text: str) -> str:
    return "Subject"


def extract_amount(text: str) -> float:
    return 100.0


def extract_currency(text: str) -> str:
    return "USD"


def extract_resource_id(text: str) -> str:
    return "res-123"


def extract_file_path(text: str) -> str:
    return "/data/files/document.txt"


def extract_config_key(text: str) -> str:
    return "max_retries"


def extract_config_value(text: str) -> str:
    return "5"


def format_search_results(results: list) -> str:
    return json.dumps(results)


def format_user_list(users: list) -> str:
    return json.dumps(users)


def format_response(response: Any) -> str:
    return str(response)


# Direct tool call patterns for testing
# These are the actual tool functions the agent calls

def search_knowledge_base(query: str) -> list:
    """Search the knowledge base (read-only tool)."""
    return [{"title": "Result 1", "score": 0.95}]


def create_document(title: str, content: str, author: str) -> str:
    """Create a new document (internal-write tool)."""
    return "doc-456"


def send_email(to: str, subject: str, body: str) -> dict:
    """Send an email (external-api tool)."""
    return {"status": "sent", "message_id": "msg-789"}


def process_payment(amount: float, currency: str, description: str) -> dict:
    """Process a payment (financial tool)."""
    return {"status": "completed", "transaction_id": "txn-999"}


def delete_resource(resource_id: str, permanent: bool = False) -> dict:
    """Delete a resource (destructive tool)."""
    return {"status": "deleted", "resource_id": resource_id}


def list_users(include_inactive: bool = False, detailed: bool = False) -> list:
    """List users (administrative tool)."""
    return [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]


def read_file(file_path: str) -> str:
    """Read a file from disk (read-only tool)."""
    return "file contents"


def update_configuration(key: str, value: str) -> dict:
    """Update system configuration (administrative tool)."""
    return {"status": "updated", "key": key, "value": value}


def query_knowledge_base(query: str) -> Any:
    """Query the general knowledge base."""
    return {"answer": "I found some information about that."}
'''


SAMPLE_AGENT_TOOL_CALLS = [
    "search_knowledge_base",
    "create_document",
    "send_email",
    "process_payment",
    "delete_resource",
    "list_users",
    "read_file",
    "update_configuration",
    "query_knowledge_base",
    "classify_intent",
]


# Sample minimal agent for quick tests
MINIMAL_AGENT_CODE = '''
def my_agent():
    result = search_knowledge_base(query="test")
    if result:
        create_document(title="test", content="hello", author="bot")
    return result
'''
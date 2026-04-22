import json
from typing import Any, Dict

try:
    from jsonschema import ValidationError as JSONSchemaValidationError
    from jsonschema.validators import validator_for
except ImportError:  # pragma: no cover - optional dependency fallback
    JSONSchemaValidationError = ValueError
    validator_for = None


def _validate_type(field: str, value: Any, expected_type: str) -> None:
    type_checks = {
        "string": lambda item: isinstance(item, str),
        "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
        "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
        "boolean": lambda item: isinstance(item, bool),
        "array": lambda item: isinstance(item, list),
        "object": lambda item: isinstance(item, dict),
    }
    checker = type_checks.get(expected_type)
    if checker and not checker(value):
        raise ValueError(f"{field}: expected {expected_type}")


def _validate_payload_without_jsonschema(schema: Dict[str, Any], payload: Dict[str, Any]) -> None:
    if not isinstance(payload, dict):
        raise ValueError("Payload must be an object")

    required = schema.get("required", [])
    properties = schema.get("properties", {})

    missing = [field for field in required if field not in payload]
    if missing:
        raise ValueError("; ".join(f"{field}: is required" for field in missing))

    for field, field_schema in properties.items():
        if field not in payload or not isinstance(field_schema, dict):
            continue
        expected_type = field_schema.get("type")
        if isinstance(expected_type, str):
            _validate_type(field, payload[field], expected_type)

def validate_json_schema(schema_str: str) -> Dict[str, Any]:
    try:
        schema = json.loads(schema_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {str(e)}")
    
    if not isinstance(schema, dict):
        raise ValueError("Schema must be a JSON object (dict)")
    
    # Validate schema semantics against the declared JSON Schema draft.
    # This catches malformed keyword usage early (e.g. minimum on strings).
    if validator_for is None:
        return schema

    try:
        validator_cls = validator_for(schema)
        validator_cls.check_schema(schema)
    except Exception as e:
        raise ValueError(f"Invalid JSON Schema: {str(e)}")
    
    return schema


def validate_payload_against_schema(schema: Dict[str, Any], payload: Dict[str, Any]) -> None:
    if validator_for is None:
        _validate_payload_without_jsonschema(schema, payload)
        return

    try:
        validator_cls = validator_for(schema)
        validator_cls.check_schema(schema)
        validator = validator_cls(schema)
        errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.path))
    except JSONSchemaValidationError as e:
        raise ValueError(f"Invalid payload: {e.message}")
    except Exception as e:
        raise ValueError(f"Schema validation error: {str(e)}")

    if not errors:
        return

    messages = []
    for err in errors[:5]:
        field = ".".join(str(part) for part in err.path)
        location = field if field else "<root>"
        messages.append(f"{location}: {err.message}")

    raise ValueError("; ".join(messages))

def validate_tool_schema(name: str, description: str, input_schema: str, output_schema: str) -> Dict[str, Any]:
    errors = []
    
    # Validate name
    if not name or len(name) < 1:
        errors.append("Tool name is required and must be non-empty")
    
    # Validate description
    if not description or len(description) < 10:
        errors.append("Tool description is required and must be at least 10 characters")
    
    # Validate input schema
    try:
        input_parsed = validate_json_schema(input_schema)
    except ValueError as e:
        errors.append(f"Invalid input_schema: {str(e)}")
        input_parsed = None
    
    # Validate output schema
    try:
        output_parsed = validate_json_schema(output_schema)
    except ValueError as e:
        errors.append(f"Invalid output_schema: {str(e)}")
        output_parsed = None
    
    if errors:
        raise ValueError("; ".join(errors))
    
    return {
        "name": name,
        "description": description,
        "input_schema": input_parsed,
        "output_schema": output_parsed,
        "valid": True
    }

from typing import Any, Optional

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableConfig

from app.core.model_providers.model_provider_manager import model_provider_manager
from app.core.workflow.utils.db_utils import get_model_info

from ...state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    parse_variables,
    update_node_outputs,
)

PARAMETER_EXTRACTOR_SYSTEM_PROMPT = """
### Job Description
You are a parameter extraction engine that analyzes text data and extracts specific parameters based on predefined schema.

### Task
Your task is to extract parameters from the input text according to the provided parameter schema. You must ensure each parameter matches its defined type and constraints.

### Format
The input text is in the variable text_field. Parameter schema is provided in JSON format.

### Constraint
- Extract ONLY the parameters defined in the schema
- Ensure parameter types match the schema definition
- Return parameters in JSON format
- DO NOT include any explanations or additional text

### Example
Here is an example between human and assistant, inside <example></example> XML tags.
<example>
User: {"text": "I want to book a flight from New York to London on July 15th, economy class", "schema": {"departure": "string", "destination": "string", "date": "string", "class": "string"}}
Assistant: {"departure": "New York", "destination": "London", "date": "July 15th", "class": "economy"}

User: {"text": "The temperature is 25 degrees and humidity is 60%", "schema": {"temperature": "number", "humidity": "number"}}
Assistant: {"temperature": 25, "humidity": 60}
</example>
"""

PARAMETER_EXTRACTOR_USER_PROMPT = """
### Input
Text: {input_text}
Parameter Schema: {parameter_schema}

### Task
Please extract the parameters from the text according to the schema.
Return only the parameters in JSON format, nothing else.
"""

class ParameterExtractorNode:
    """Parameter Extractor Node for extracting structured parameters from text"""

    def __init__(
        self,
        node_id: str,
        model_name: str,
        parameter_schema: dict[str, str],
        input: str = "",
    ):
        self.node_id = node_id
        self.parameter_schema = parameter_schema
        self.input = input
        self.model_info = get_model_info(model_name)

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState:
        """Execute parameter extraction work"""
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        # Parse input variable if exists
        input_text = (
            parse_variables(self.input, state["node_outputs"]) if self.input else None
        )
        if not input_text and state.get("all_messages"):
            input_text = state["all_messages"][-1].content

        # Initialize LLM with provider info
        llm = model_provider_manager.init_model(
            provider_name=self.model_info["provider_name"],
            model=self.model_info["ai_model_name"],
            temperature=0.1,
            api_key=self.model_info["api_key"],
            base_url=self.model_info["base_url"],
        )

        # Prepare input in JSON format
        input_json = {
            "input_text": input_text,
            "parameter_schema": self.parameter_schema
        }

        # Prepare prompt and get extraction result
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", PARAMETER_EXTRACTOR_SYSTEM_PROMPT),
                ("user", PARAMETER_EXTRACTOR_USER_PROMPT),
            ]
        )
        outputparser = JsonOutputParser()
        chain = prompt | llm | outputparser

        # Add helper function to normalize result
        def normalize_parameters(result: Any) -> dict:
            """Normalize parameter extraction result"""
            try:
                if isinstance(result, dict):
                    normalized = {}
                    for key, value in result.items():
                        if key in self.parameter_schema:
                            param_type = self.parameter_schema[key]
                            if param_type == "number":
                                try:
                                    normalized[key] = float(value)
                                except (ValueError, TypeError):
                                    normalized[key] = 0
                            elif param_type == "string":
                                normalized[key] = str(value) if value else ""
                            else:
                                normalized[key] = value
                        print(normalized,"-------===================")
                    return normalized
                else:
                    print(f"Unexpected result format: {result}")
                    return {}
            except Exception as e:
                print(f"Error normalizing parameters: {e}")
                return {}

        result = await chain.ainvoke(input_json)

        # Normalize and validate parameters
        parameters = normalize_parameters(result)

        # Update node outputs
        new_output = {
            self.node_id: parameters
        }
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnWorkflowTeamState = {
            "node_outputs": state["node_outputs"],
        }

        return return_state

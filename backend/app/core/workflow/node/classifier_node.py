from typing import Any, Dict
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.output_parsers import JsonOutputParser
from .state import ReturnTeamState, TeamState, parse_variables, update_node_outputs
from app.core.model_providers.model_provider_manager import model_provider_manager
from langchain_core.prompts import ChatPromptTemplate

CLASSIFIER_SYSTEM_PROMPT = """
### Job Description
You are a text classification engine that analyzes text data and assigns categories based on user input or automatically determined categories.

### Task
Your task is to assign one categories ONLY to the input text and only one category may be assigned returned in the output. Additionally, you need to extract the key words from the text that are related to the classification.

### Format
The input text is in the variable text_field. Categories are specified as a category list with category_name in the variable categories.

### Constraint
DO NOT include anything other than the category name in your response.
DO NOT include anything other than the JSON array in your response.

### Example
Here is the chat example between human and assistant, inside <example></example> XML tags.
<example>
User:{{"input_text": ["I recently had a great experience with your company. The service was prompt and the staff was very friendly."], "categories": ["Customer Service","Satisfaction","Sales","Product"]}}
Assistant:{{"keywords": ["recently", "great experience", "company", "service", "prompt", "staff", "friendly"],"category_name": "Customer Service"}}
User:{{"input_text": ["bad service, slow to bring the food"], "categories": ["Food Quality","Experience","Price"]}}
Assistant:{{"keywords": ["bad service", "slow", "food", "tip", "terrible", "waitresses"],"category_name": "Experience"}}
</example>
"""

QUESTION_CLASSIFIER_USER_PROMPT = """
 ### Input
    {input_text},
    {categories},
   ### Assistant Output
    Please classify the above text into exactly one of the listed categories.
    Return only the category name, nothing else.
"""


class ClassifierNode:
    """Classifier Node for classifying input text into predefined categories"""

    def __init__(
        self,
        node_id: str,
        provider: str,
        model: str,
        categories: list[Dict[str, str]],
        input: str = "",
        openai_api_key: str = "",
        openai_api_base: str = "",
    ):
        self.node_id = node_id
        self.provider = provider
        self.model = model
        self.categories = categories
        self.input = input
        self.openai_api_key = openai_api_key
        self.openai_api_base = openai_api_base

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        """Execute classification work"""
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        # Parse input variable if exists
        input_text = (
            parse_variables(self.input, state["node_outputs"]) if self.input else ""
        )
        if not input_text and state.get("all_messages"):
            input_text = state["all_messages"][-1].content

        # Initialize LLM with provider info
        llm = model_provider_manager.init_model(
            provider_name=self.provider,
            model=self.model,
            temperature=0.1,
            openai_api_key=self.openai_api_key,
            openai_api_base=self.openai_api_base,
        )

        # Prepare categories list and input in JSON format
        categories_list = [cat["category_name"] for cat in self.categories]
        input_json = {"input_text": [input_text], "categories": categories_list}

        # Prepare prompt and get classification result
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", CLASSIFIER_SYSTEM_PROMPT),
                ("user", QUESTION_CLASSIFIER_USER_PROMPT),
            ]
        )
        outputparser = JsonOutputParser()
        chain = prompt | llm | outputparser
        result = await chain.ainvoke(input_json)
        print("classifier result:", result)
        # Find matching category and get its ID
        matched_category = next(
            (
                cat
                for cat in self.categories
                if cat["category_name"].lower() == result["category_name"].lower()
            ),
            self.categories[0],  # Default to first category if no match found
        )

        # Create response message
        result_message = AIMessage(content=matched_category["category_name"])

        # Update node outputs with both category_name and category_id
        new_output = {
            self.node_id: {
                "category_id": matched_category["category_id"],  # 更语义化的键名
                "category_name": matched_category[
                    "category_name"
                ],  # 保存分类名称供参考
            }
        }
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnTeamState = {
            "node_outputs": state["node_outputs"],
        }

        return return_state

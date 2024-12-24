from typing import Any, Dict
from app.core.workflow.utils.db_utils import get_model_info
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
        model_name: str,
        categories: list[Dict[str, str]],
        input: str = "",
    ):
        self.node_id = node_id

        self.categories = categories
        self.input = input

        self.model_info = get_model_info(model_name)

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
            provider_name=self.model_info["provider_name"],
            model=self.model_info["ai_model_name"],
            temperature=0.1,
            api_key=self.model_info["api_key"],
            base_url=self.model_info["base_url"],
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

        # Add helper function to normalize result
        def normalize_category_result(result: Any) -> str:
            """Normalize classifier result to get category name string"""
            try:
                if isinstance(result, list) and len(result) > 0:
                    return str(result[0])
                elif isinstance(result, dict) and "category_name" in result:
                    return str(result["category_name"])
                elif isinstance(result, str):
                    return result
                else:
                    print(f"Unexpected result format: {result}")
                    # 使用 others 分类作为默认
                    return "Others Intent"
            except Exception as e:
                print(f"Error normalizing result: {e}")
                # 出错时使用 others 分类
                return "Others Intent"

        result = await chain.ainvoke(input_json)

        # Ensure categories is not empty and has valid format
        if not self.categories or not isinstance(self.categories, list):
            print("Invalid categories format")
            return {"node_outputs": state.get("node_outputs", {})}

        # Get normalized category name
        category_name = normalize_category_result(result)

        try:
            # Find matching category and get its ID
            matched_category = next(
                (
                    cat
                    for cat in self.categories
                    if isinstance(cat, dict)
                    and "category_name" in cat
                    and "category_id" in cat
                    and cat["category_name"].lower() == category_name.lower()
                ),
                next(  # 如果没找到匹配的类别，使用 others 类别
                    (
                        cat
                        for cat in self.categories
                        if cat["category_id"] == "others_category"
                    ),
                    {
                        "category_id": "others_category",
                        "category_name": "Others Intent",
                    },  # 最后的 fallback
                ),
            )
        except Exception as e:
            print(f"Error matching category: {e}")
            # 确保使用 others 类别作为 fallback
            matched_category = next(
                (
                    cat
                    for cat in self.categories
                    if cat["category_id"] == "others_category"
                ),
                {"category_id": "others_category", "category_name": "Others Intent"},
            )
        print("matched_category:", matched_category)
        # Update node outputs with both category_id and category_name
        new_output = {
            self.node_id: {
                "category_id": matched_category["category_id"],
                "category_name": matched_category["category_name"],
            }
        }
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnTeamState = {
            "node_outputs": state["node_outputs"],
        }

        return return_state

from typing import Dict, Any
from langchain_core.runnables import RunnableConfig
from ..state import ReturnTeamState, TeamState, parse_variables, update_node_outputs


class IfElseNode:
    """Node for handling conditional logic in workflow"""

    def __init__(self, node_id: str, cases: list[Dict[str, Any]]):
        self.node_id = node_id
        self.cases = cases

    def _evaluate_condition(self, condition: Dict[str, Any], state: TeamState) -> bool:
        """Evaluate a single condition"""
        # 解析变量
        field_value = (
            parse_variables(condition["field"], state["node_outputs"])
            if condition["field"]
            else ""
        )

        if condition["compareType"] == "variable":
            compare_value = (
                parse_variables(condition["value"], state["node_outputs"])
                if condition["value"]
                else ""
            )
        else:
            compare_value = condition["value"]

        # 根据操作符进行比较
        match condition["comparison_operator"]:
            case "contains":
                return str(field_value).find(str(compare_value)) != -1
            case "notContains":
                return str(field_value).find(str(compare_value)) == -1
            case "startWith":
                return str(field_value).startswith(str(compare_value))
            case "endWith":
                return str(field_value).endswith(str(compare_value))
            case "equal":
                return str(field_value) == str(compare_value)
            case "notEqual":
                return str(field_value) != str(compare_value)
            case "empty":
                return not bool(field_value)
            case "notEmpty":
                return bool(field_value)
            case _:
                raise ValueError(
                    f"Unknown operator: {condition['comparison_operator']}"
                )

    def _evaluate_case(self, case: Dict[str, Any], state: TeamState) -> bool:
        """Evaluate all conditions in a case"""
        if case["case_id"] == "false_else" or not case["conditions"]:
            return False

        results = [self._evaluate_condition(cond, state) for cond in case["conditions"]]

        # 根据逻辑运算符组合结果
        if case["logical_operator"] == "and":
            return all(results)
        else:  # "or"
            return any(results)

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        """Execute the if-else logic"""
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        # 遍历所有case进行判断
        for case in self.cases:
            if case["case_id"] == "false_else":  # ELSE case
                result_case_id = case["case_id"]
                break

            if self._evaluate_case(case, state):
                result_case_id = case["case_id"]
                break
        else:
            result_case_id = "false_else"  # 如果没有匹配的case，使用ELSE

        # 更新节点输出
        print(f"result_case_id==================: {result_case_id}")
        new_output = {self.node_id: {"result": result_case_id}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnTeamState = {
            "node_outputs": state["node_outputs"],
        }
        return return_state

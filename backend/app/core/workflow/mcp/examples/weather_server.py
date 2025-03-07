import asyncio
import json
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

# 模拟天气数据
WEATHER_DATA = {
    "forecasts": {
        "40.7128,-74.0060": [  # 纽约
            {
                "date": "2024-03-07",
                "temperature": 12,
                "condition": "晴朗",
                "wind": "东北风 3级",
                "humidity": 65
            },
            {
                "date": "2024-03-08",
                "temperature": 15,
                "condition": "多云",
                "wind": "东风 2级",
                "humidity": 70
            }
        ],
        "39.9042,116.4074": [  # 北京
            {
                "date": "2024-03-07",
                "temperature": 18,
                "condition": "多云",
                "wind": "西北风 4级",
                "humidity": 55
            },
            {
                "date": "2024-03-08",
                "temperature": 20,
                "condition": "晴朗",
                "wind": "北风 3级",
                "humidity": 50
            }
        ]
    },
    "alerts": {
        "NY": [
            {
                "type": "大风预警",
                "level": "黄色",
                "description": "预计未来12小时内可能出现7-8级大风",
                "issued_at": "2024-03-07 08:00:00"
            }
        ],
        "BJ": [
            {
                "type": "空气质量预警",
                "level": "橙色",
                "description": "预计未来24小时内空气质量指数可能超过200",
                "issued_at": "2024-03-07 09:00:00"
            }
        ]
    }
}

class WeatherServer:
    """简单的天气服务器实现"""
    
    def __init__(self):
        self.tools = [
            {
                "name": "get_forecast",
                "description": "获取指定位置的天气预报",
                "parameters": [
                    {
                        "name": "latitude",
                        "type": "float",
                        "description": "纬度",
                        "required": True
                    },
                    {
                        "name": "longitude",
                        "type": "float",
                        "description": "经度",
                        "required": True
                    }
                ]
            },
            {
                "name": "get_alerts",
                "description": "获取指定地区的天气预警",
                "parameters": [
                    {
                        "name": "region",
                        "type": "string",
                        "description": "地区代码 (例如: NY, BJ)",
                        "required": True
                    }
                ]
            }
        ]
    
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """处理客户端请求"""
        try:
            if request["type"] == "tool_call":
                tool_name = request["tool"]
                params = request.get("params", {})
                
                if tool_name == "__list_tools":
                    return {"result": self.tools}
                elif tool_name == "get_forecast":
                    return {"result": await self.get_forecast(**params)}
                elif tool_name == "get_alerts":
                    return {"result": await self.get_alerts(**params)}
                else:
                    return {"error": f"Unknown tool: {tool_name}"}
            else:
                return {"error": f"Unknown request type: {request['type']}"}
        except Exception as e:
            return {"error": str(e)}
    
    async def get_forecast(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """获取天气预报"""
        location_key = f"{latitude},{longitude}"
        forecasts = WEATHER_DATA["forecasts"].get(location_key)
        
        if not forecasts:
            return {
                "error": "Location not found",
                "nearest_locations": list(WEATHER_DATA["forecasts"].keys())
            }
        
        return {
            "location": location_key,
            "forecasts": forecasts,
            "updated_at": datetime.now().isoformat()
        }
    
    async def get_alerts(self, region: str) -> Dict[str, Any]:
        """获取天气预警"""
        alerts = WEATHER_DATA["alerts"].get(region, [])
        return {
            "region": region,
            "alerts": alerts,
            "updated_at": datetime.now().isoformat()
        }

async def main():
    """主函数"""
    server = WeatherServer()
    
    while True:
        try:
            # 从标准输入读取请求
            line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
            if not line:
                break
                
            # 解析请求
            request = json.loads(line)
            
            # 处理请求
            response = await server.handle_request(request)
            
            # 发送响应
            print(json.dumps(response), flush=True)
            
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)

if __name__ == "__main__":
    asyncio.run(main()) 
import sys
import json
import base64
import os
import time
from playwright.sync_api import sync_playwright

_CONFIG_B64_ = '###CONFIG_B64###'

def main():
    try:
        config = json.loads(base64.b64decode(_CONFIG_B64_).decode('utf-8'))
    except Exception:
        config = {
            "url": "https://www.baidu.com",
            "action": "goto",
            "selector": None,
            "text": None,
            "x": None,
            "y": None,
            "element_id": None,
            "key": None
        }

    url = config.get("url")
    action = config.get("action", "goto").lower()
    if action in ["open", "navigate"]:
        action = "goto"
        
    sel_val = config.get("selector")
    text_val = config.get("text")
    pos_x = config.get("x")
    pos_y = config.get("y")
    element_id = config.get("element_id")
    key_val = config.get("key")
    
    with sync_playwright() as p:
        browser = None
        is_cdp = False
        
        try:
            browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            is_cdp = True
            context = browser.contexts[0]
            active_page = None
            if context.pages:
                for p_candidate in reversed(context.pages):
                    if p_candidate.url and p_candidate.url != "about:blank":
                        active_page = p_candidate
                        break
            page = active_page if active_page else (context.pages[0] if context.pages else context.new_page())
        except Exception as e:
            print(f"CDP_CONNECT_WARNING: {e}", file=sys.stderr)
            browser = p.chromium.launch(headless=False, args=["--no-sandbox", "--disable-setuid-sandbox"])
            page = browser.new_page()

        should_goto = False
        if action == "goto" or not is_cdp:
            should_goto = True
        else:
            current_url = page.url
            if current_url == "about:blank" or not current_url:
                should_goto = True

        if should_goto and url:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(2000)
            except Exception as e:
                print(f"GOTO_WARNING: {e}", file=sys.stderr)
        
        try:
            if action == "click":
                if sel_val:
                    page.click(sel_val, timeout=5000)
                    page.wait_for_timeout(1000)
            elif action == "click_coord":
                if pos_x is not None and pos_y is not None:
                    page.mouse.click(float(pos_x), float(pos_y))
                    page.wait_for_timeout(1000)
            elif action == "click_id":
                if element_id is not None:
                    page.evaluate(f'''() => {{
                        const el = document.querySelector(`[flock-id="{element_id}"]`);
                        if (el) {{
                            el.scrollIntoView({{block: 'center'}});
                            el.click();
                        }}
                    }}''')
                    page.wait_for_timeout(1000)
            elif action == "fill":
                if sel_val:
                    page.fill(sel_val, text_val or "", timeout=5000)
                    page.wait_for_timeout(1000)
            elif action == "fill_id":
                if element_id is not None:
                    page.evaluate(f'''() => {{
                        const el = document.querySelector(`[flock-id="{element_id}"]`);
                        if (el) {{
                            el.scrollIntoView({{block: 'center'}});
                            el.focus();
                            el.value = `{text_val or ""}`;
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }}
                    }}''')
                    page.wait_for_timeout(1000)
            elif action == "scroll_down":
                page.mouse.wheel(0, 800)
                page.wait_for_timeout(1000)
            elif action == "scroll_up":
                page.mouse.wheel(0, -800)
                page.wait_for_timeout(1000)
            elif action == "press_key":
                if key_val:
                    page.keyboard.press(key_val)
                    page.wait_for_timeout(1000)
            elif action == "interactive":
                pass
        except Exception as e:
            print(f"ACTION_WARNING: {e}", file=sys.stderr)
        
        try:
            # Take clean/raw screenshot first
            try:
                page.evaluate("() => document.querySelectorAll('.flock-mark-box').forEach(el => el.remove())")
            except Exception:
                pass
            raw_screenshot_bytes = page.screenshot(timeout=5000)
            print("RAW_SCREENSHOT_B64_START")
            print(base64.b64encode(raw_screenshot_bytes).decode('utf-8'))
            print("RAW_SCREENSHOT_B64_END")
        except Exception as e:
            print(f"RAW_SCREENSHOT_ERROR: {e}", file=sys.stderr)

        dom_markdown = ""
        try:
            page.wait_for_timeout(1000)
            mark_script = """
            () => {
                let idCounter = 0;
                const elements = [];
                const interactables = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])');
                
                document.querySelectorAll('.flock-mark-box').forEach(el => el.remove());
                
                for (const el of interactables) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth)) {
                        const style = window.getComputedStyle(el);
                        if (style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0') {
                            idCounter++;
                            el.setAttribute('flock-id', idCounter);
                            
                            const box = document.createElement('div');
                            box.className = 'flock-mark-box';
                            box.style.position = 'absolute';
                            box.style.left = (rect.left + window.scrollX) + 'px';
                            box.style.top = (rect.top + window.scrollY) + 'px';
                            box.style.width = rect.width + 'px';
                            box.style.height = rect.height + 'px';
                            box.style.border = '2px solid red';
                            box.style.backgroundColor = 'rgba(255,0,0,0.1)';
                            box.style.pointerEvents = 'none';
                            box.style.zIndex = 2147483647;
                            
                            const label = document.createElement('div');
                            label.style.position = 'absolute';
                            label.style.left = '0';
                            label.style.top = '0';
                            label.style.backgroundColor = 'red';
                            label.style.color = 'white';
                            label.style.fontSize = '12px';
                            label.style.padding = '1px 3px';
                            label.style.fontWeight = 'bold';
                            label.innerText = idCounter;
                            
                            box.appendChild(label);
                            document.body.appendChild(box);
                            
                            let text = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('alt') || '';
                            text = text.replace(/\\n/g, ' ').substring(0, 30).trim();
                            if (!text) { text = 'Empty'; }
                            
                            elements.push(`[${idCounter}] ${el.tagName.toLowerCase()} "${text}" (x: ${Math.round(rect.left + rect.width/2)}, y: ${Math.round(rect.top + rect.height/2)})`);
                        }
                    }
                }
                return elements.join('\\n');
            }
            """
            dom_markdown = page.evaluate(mark_script)
            print(f"DOM_TREE_START\n{dom_markdown}\nDOM_TREE_END")
        except Exception as e:
            print(f"MARK_WARNING: {e}", file=sys.stderr)

        try:
            screenshot_bytes = page.screenshot(timeout=5000)
            print("SCREENSHOT_B64_START")
            print(base64.b64encode(screenshot_bytes).decode('utf-8'))
            print("SCREENSHOT_B64_END")
        except Exception as e:
            print(f"SCREENSHOT_ERROR: {e}", file=sys.stderr)

        # 截图保存（带红框的 AI 识别图）完成后，立即清理掉插入到页面 DOM 中的红框标记元素，防止红框在 VNC 中残留污染用户画面
        try:
            page.evaluate("() => document.querySelectorAll('.flock-mark-box').forEach(el => el.remove())")
        except Exception:
            pass
        
        try:
            title = page.title()
            print(f"TITLE: {title}")
        except Exception as e:
            pass
            
        if not is_cdp:
            try:
                browser.close()
            except Exception:
                pass

        # 强制正常退出当前进程，避开 with 块清理时 Playwright CDP 连接异常导致的退出码非零问题
        os._exit(0)

if __name__ == "__main__":
    main()

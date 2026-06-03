import sys
import json
import base64
from playwright.sync_api import sync_playwright

_URL_B64_ = '###URL_B64###'
_URL_ = base64.b64decode(_URL_B64_).decode('utf-8')

try:
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        context = browser.contexts[0]
        active_page = None
        if context.pages:
            for p_candidate in reversed(context.pages):
                if p_candidate.url and p_candidate.url != "about:blank":
                    active_page = p_candidate
                    break
        page = active_page if active_page else (context.pages[0] if context.pages else context.new_page())
        
        try:
            page.goto(_URL_, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(3000)
        except Exception as e:
            print(f"GOTO_WARNING: {e}", file=sys.stderr)
            
        captcha_selectors = [
            'iframe[src*="recaptcha"]',
            'iframe[src*="hcaptcha"]',
            'iframe[src*="turnstile"]',
            'div[class*="geetest"]',
            'div[id*="geetest"]',
            'div[class*="captcha"]',
            'div[id*="captcha"]',
            'iframe[src*="captcha"]',
            'div[id*="cf-turnstile"]',
            'div[class*="cf-turnstile"]'
        ]
        
        has_password = page.locator('input[type="password"]').count() > 0
        has_captcha = False
        for sel in captcha_selectors:
            try:
                if page.locator(sel).count() > 0:
                    has_captcha = True
                    break
            except Exception:
                pass
                
        page_text = page.evaluate("() => document.body.innerText || ''").lower()
        url_lower = page.url.lower()
        
        is_sensitive_login = any(kw in page_text for kw in ["密码", "password", "pass word"]) or "signin" in url_lower or "login" in url_lower
        login_keywords = ["登录", "signin", "login", "sign in", "log in", "log-in", "sign-in"]
        has_login_text = any(kw in page_text for kw in login_keywords)
        
        captcha_keywords = ["验证码", "captcha", "slider", "滑块", "点击验证", "验证", "安全校验", "verify", "verification"]
        is_sensitive_captcha = any(kw in page_text for kw in captcha_keywords)
        
        need_takeover = has_password or has_captcha or (is_sensitive_login and has_login_text) or is_sensitive_captcha
        print("CHECK_RESULT:" + json.dumps({
            "need_takeover": need_takeover,
            "has_password": has_password,
            "has_captcha": has_captcha
        }))
        
        try:
            screenshot_bytes = page.screenshot(timeout=5000)
            print("SCREENSHOT_B64_START")
            print(base64.b64encode(screenshot_bytes).decode('utf-8'))
            print("SCREENSHOT_B64_END")
        except Exception as e:
            print(f"SCREENSHOT_ERROR: {e}", file=sys.stderr)
            
except Exception as e:
    print(f"FATAL_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
sys.exit(0)

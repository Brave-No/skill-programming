from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://127.0.0.1:5174/games/rainline/?stage=code"
OUTPUTS = Path(__file__).resolve().parents[1] / "outputs"

CUSTOM_BODY = """int l = 0;
int r = height.length - 1;
int highL = height.length == 0 ? 0 : height[l];
int highR = height.length == 0 ? 0 : height[r];
int result = 0;
while (l < r) {
  if (highL <= highR) {
    l++;
    highL = Math.max(height[l], highL);
    result += highL - height[l];
  } else {
    r--;
    highR = Math.max(height[r], highR);
    result += highR - height[r];
  }
}
return result;"""

HIDDEN_FAILURE_BODY = CUSTOM_BODY.replace(
    "return result;",
    "if (height.length != 6) { result += 1; }\nreturn result;",
)


def assert_no_overflow(page, label: str) -> None:
    metrics = page.evaluate(
        """() => ({
            innerWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
        })"""
    )
    assert metrics["scrollWidth"] <= metrics["innerWidth"], (label, metrics)
    assert metrics["bodyScrollWidth"] <= metrics["innerWidth"], (label, metrics)


def fill_structured_mode(page) -> None:
    preparation = [
        "int l = 0",
        "int r = height.length - 1",
        "int highL = height.length == 0 ? 0 : height[l]",
        "int highR = height.length == 0 ? 0 : height[r]",
        "int result = 0",
    ]
    first = page.get_by_label("准备双端状态第 1 行")
    first.click()
    first.press_sequentially(preparation[0])
    assert first.input_value() == preparation[0]
    for index, value in enumerate(preparation[1:], start=2):
        page.get_by_label(f"准备双端状态第 {index} 行").fill(value)

    page.get_by_label("巡检条件").fill("l < r")
    page.get_by_role("textbox", name="选择较低岸线", exact=True).fill("highL <= highR")
    page.get_by_label("左侧向内第 1 行").fill("l++")
    page.get_by_label("更新左岸最高柱第 1 行").fill(
        "highL = Math.max(height[l], highL)"
    )
    page.get_by_label("计算左侧积水第 1 行").fill(
        "result += highL - height[l]"
    )
    page.get_by_label("右侧向内第 1 行").fill("r--")
    page.get_by_label("更新右岸最高柱第 1 行").fill(
        "highR = Math.max(height[r], highR)"
    )
    page.get_by_label("计算右侧积水第 1 行").fill(
        "result += highR - height[r]"
    )
    page.get_by_role("textbox", name="返回总量", exact=True).fill("result")


def replace_editor_text(page, value: str) -> None:
    editor = page.locator(".cm-content")
    editor.click()
    editor.press("ControlOrMeta+A")
    page.keyboard.insert_text(value)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    desktop_context = browser.new_context(viewport={"width": 1440, "height": 1000})
    desktop = desktop_context.new_page()
    errors = []
    desktop.on(
        "console",
        lambda message: errors.append(f"console:{message.type}:{message.text}")
        if message.type == "error"
        else None,
    )
    desktop.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    desktop.goto(BASE_URL)
    desktop.wait_for_load_state("networkidle")
    desktop.evaluate("localStorage.clear()")
    desktop.reload()
    desktop.wait_for_load_state("networkidle")

    expect(desktop.get_by_role("heading", name="把双端巡检写成代码")).to_be_visible()
    expect(desktop.locator("[data-step-id]")).to_have_count(12)
    expect(desktop.locator(".rain-code-status")).to_contain_text("待填写 10 项语义")
    expect(desktop.locator(".rain-code-status")).not_to_have_class("is-error")
    assert_no_overflow(desktop, "desktop-initial")

    desktop.get_by_role("tab", name="代码词典").click()
    expect(desktop.get_by_role("button", name="左岸最高柱", exact=True)).to_be_visible()
    expect(desktop.get_by_role("button", name="右岸最高柱", exact=True)).to_be_visible()
    expect(desktop.get_by_role("button", name="左侧巡线位置", exact=True)).to_be_visible()
    expect(desktop.get_by_role("button", name="右侧巡线位置", exact=True)).to_be_visible()
    assert desktop.get_by_role("button", name="左岸最高柱", exact=True).get_attribute("data-concept-ids") == "left-maximum"
    desktop.get_by_role("tab", name="逻辑代码").click()

    desktop.locator(".rain-code-fragment button").first.click()
    assert desktop.get_by_label("准备双端状态第 1 行").input_value() == ""

    desktop.get_by_role("button", name="运行当前用例").click()
    expect(desktop.locator(".rain-code-status")).to_contain_text("准备双端状态还没有填写")
    desktop.get_by_role("button", name="提交全部用例").click()
    expect(desktop.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    assert desktop.evaluate("document.activeElement?.getAttribute('aria-label')") == "准备双端状态第 1 行"

    fill_structured_mode(desktop)
    desktop.get_by_role("button", name="运行当前用例").click()
    expect(desktop.get_by_text("当前用例通过", exact=True)).to_be_visible()
    desktop.get_by_role("button", name="提交全部用例").click()
    celebration = desktop.get_by_role("dialog", name="关卡通关")
    expect(celebration).to_be_visible()
    expect(celebration.get_by_text("结构、语义与真实用例全部通过", exact=True)).to_be_visible()
    expect(celebration.get_by_label("10 / 10 个公开与隐藏用例通过")).to_be_visible()
    celebration.get_by_role("button", name="重播通关动画").click()
    expect(celebration).to_be_visible()
    desktop.keyboard.press("Escape")
    expect(desktop.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(desktop.locator(".rain-submission-result")).to_contain_text("10 / 10")
    desktop.get_by_role("button", name="提交全部用例").click()
    expect(desktop.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(desktop.locator(".rain-submission-result")).to_contain_text("10 / 10")
    expect(desktop.locator(".rain-panel-heading > span")).to_have_text("12/12")
    desktop.screenshot(path=OUTPUTS / "rainline-code-structured-desktop.png", full_page=True)

    expect(desktop.get_by_text("草稿已保存", exact=True)).to_be_visible(timeout=2000)
    desktop.reload()
    desktop.wait_for_load_state("networkidle")
    expect(desktop.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    assert desktop.get_by_label("准备双端状态第 1 行").input_value() == "int l = 0"

    desktop.get_by_role("radio", name="自由编写").click()
    expect(desktop.locator(".rain-code-status")).to_contain_text("尚未运行")
    replace_editor_text(desktop, CUSTOM_BODY)
    desktop.get_by_role("button", name="提交全部用例").click()
    expect(desktop.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(desktop.locator(".rain-submission-result")).to_contain_text("全部公开与隐藏用例通过")

    replace_editor_text(desktop, HIDDEN_FAILURE_BODY)
    expect(desktop.locator(".rain-failure-example")).to_have_count(0)
    desktop.get_by_role("button", name="提交全部用例").click()
    failure_example = desktop.locator(".rain-failure-example")
    expect(failure_example).to_have_count(1)
    expect(failure_example).to_contain_text("当前卡住的用例")
    expect(failure_example).to_contain_text("第 4 个用例")
    expect(failure_example).to_contain_text("隐藏 · 提交后揭示")
    expect(failure_example).to_contain_text("[]")
    expect(failure_example).to_contain_text("0 格")
    expect(failure_example).to_contain_text("1 格")
    assert "[2]" not in failure_example.inner_text()

    desktop.get_by_role("button", name="重置当前模式").click()
    expect(desktop.locator(".cm-content")).to_have_text("")
    desktop.get_by_role("radio", name="结构填写").click()
    assert desktop.get_by_label("准备双端状态第 1 行").input_value() == "int l = 0"

    desktop.get_by_role("button", name="返回技能调试").click()
    expect(desktop.get_by_role("heading", name="同一套规则，三段地形")).to_be_visible()
    assert errors == [], errors
    desktop_context.close()

    mobile_context = browser.new_context(
        viewport={"width": 390, "height": 844}, reduced_motion="reduce"
    )
    mobile = mobile_context.new_page()
    mobile.goto(BASE_URL)
    mobile.wait_for_load_state("networkidle")
    expect(mobile.locator(".rain-reference-panel")).to_be_visible()
    expect(mobile.locator(".rain-editor-panel")).not_to_be_visible()
    mobile.get_by_role("button", name="编辑", exact=True).click()
    expect(mobile.locator(".rain-editor-panel")).to_be_visible()
    expect(mobile.locator(".rain-reference-panel")).not_to_be_visible()
    first_mobile = mobile.get_by_label("准备双端状态第 1 行")
    first_mobile.press_sequentially("int l = 0")
    assert first_mobile.input_value() == "int l = 0"
    assert_no_overflow(mobile, "mobile-editor")

    mobile.get_by_role("radio", name="自由编写").click()
    replace_editor_text(mobile, CUSTOM_BODY)
    mobile.get_by_role("button", name="提交全部用例").click()
    mobile_celebration = mobile.get_by_role("dialog", name="关卡通关")
    expect(mobile_celebration).to_be_visible()
    expect(mobile_celebration.get_by_label("10 / 10 个公开与隐藏用例通过")).to_be_visible()
    assert mobile_celebration.locator(".sp-completion__verdict").evaluate(
        "node => getComputedStyle(node).opacity"
    ) == "1"
    assert mobile_celebration.locator(".sp-completion__verdict").evaluate(
        "node => getComputedStyle(node).animationName"
    ) == "none"
    assert_no_overflow(mobile, "mobile-completion")
    mobile.screenshot(path=OUTPUTS / "rainline-completion-mobile-reduced.png")
    mobile_celebration.get_by_role("button", name="跳过通关动画").click()
    expect(mobile.locator(".rain-submission-result")).to_contain_text("10 / 10")

    replace_editor_text(mobile, HIDDEN_FAILURE_BODY)
    mobile.get_by_role("button", name="提交全部用例").click()
    expect(mobile.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(mobile.locator(".rain-failure-example")).to_contain_text("当前卡住的用例")
    assert_no_overflow(mobile, "mobile-failure-example")
    mobile.screenshot(path=OUTPUTS / "rainline-code-structured-mobile.png", full_page=True)
    mobile_context.close()

    browser.close()

print("RAINLINE_CODE_E2E_PASS completion structured free first-failure drafts desktop mobile reduced-motion")

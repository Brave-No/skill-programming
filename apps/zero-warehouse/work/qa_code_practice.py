import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("ZERO_WAREHOUSE_BASE_URL", "http://127.0.0.1:5173/v2")
ORIGIN = BASE_URL.split("/v2", 1)[0]
OUTPUTS = Path(__file__).resolve().parents[1] / "outputs"
OUTPUTS.mkdir(exist_ok=True)
STEP_IDS = [
    "initialize-write-pointer",
    "open-scan-loop",
    "open-cargo-condition",
    "swap-cargo",
    "advance-write-pointer",
    "close-cargo-condition",
    "close-scan-loop",
]
CUSTOM_BODY = """int len = nums.length;
int fast = 0;
int slow = 0;
for (fast = 0; fast < len; fast++) {
  if (nums[fast] != 0) {
    int tmp = nums[slow];
    nums[slow] = nums[fast];
    nums[fast] = tmp;
    slow++;
  }
}"""


def assert_no_horizontal_overflow(page):
    dimensions = page.evaluate(
        """
        () => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        })
        """
    )
    assert dimensions["scrollWidth"] <= dimensions["clientWidth"] + 1, dimensions


def editor_value(page):
    return page.locator(".cm-content").text_content().strip()


def assert_reference_complete(page):
    expect(page.locator(".logic-reference-step")).to_have_count(7)
    expect(page.locator('[data-step-id="initialize-write-pointer"] code')).to_have_text(
        "int writeIndex = 0;"
    )
    expect(page.locator('[data-step-id="open-scan-loop"] code')).to_have_text(
        "for (int scanIndex = 0; scanIndex < nums.length; scanIndex++) {"
    )
    expect(page.locator('[data-step-id="open-cargo-condition"] code')).to_have_text(
        "if (nums[scanIndex] != 0) {"
    )
    assert page.locator('[data-step-id="swap-cargo"] code').inner_text().splitlines() == [
        "    int temp = nums[scanIndex];",
        "    nums[scanIndex] = nums[writeIndex];",
        "    nums[writeIndex] = temp;",
    ]
    expect(page.locator('[data-step-id="advance-write-pointer"] code')).to_have_text(
        "writeIndex++;"
    )
    expect(page.locator('[data-step-id="open-scan-loop"]')).to_have_attribute(
        "data-structured-slots", "loop-init,loop-condition,loop-update"
    )
    expect(page.locator('[data-step-id="open-cargo-condition"]')).to_have_attribute(
        "data-structured-slots", "occupied-condition"
    )
    expect(page.locator('[data-step-id="swap-cargo"]')).to_have_attribute(
        "data-structured-slots", "swap"
    )
    expect(page.locator('[data-step-id="advance-write-pointer"]')).to_have_attribute(
        "data-structured-slots", "slow-update"
    )
    for step_id in ["close-cargo-condition", "close-scan-loop"]:
        expect(page.locator(f'[data-step-id="{step_id}"]')).to_have_attribute(
            "data-locked-structure", "true"
        )
        expect(page.locator(f'[data-step-id="{step_id}"]')).to_have_attribute(
            "data-structured-slots", ""
        )
    depths = page.locator(".logic-reference-step").evaluate_all(
        "nodes => nodes.map(node => Number(node.dataset.scopeDepth))"
    )
    assert depths == [0, 0, 1, 2, 2, 1, 0], depths


def assemble_from_copied_steps(page):
    editor = page.locator(".cm-content")
    assembled = []
    for step_id in STEP_IDS:
        before = editor_value(page)
        step = page.locator(f'[data-step-id="{step_id}"]')
        step.get_by_role("button", name="复制代码段：", exact=False).click()
        expect(step.get_by_text("已复制", exact=True)).to_be_visible()
        assert editor_value(page) == before
        copied = page.evaluate("navigator.clipboard.readText()")
        assert copied.strip(), step_id
        assembled.append(copied)
    editor.fill("\n".join(assembled))
    expect(page.locator(".logic-progress")).to_have_text("7/7")
    return "\n".join(assembled)


def fill_custom_structure(page, include_slow_update=True):
    preparation = [
        "int len = nums.length",
        "int fast = 0",
        "int slow = 0",
    ]
    for index, value in enumerate(preparation, start=1):
        page.get_by_role("textbox", name=f"准备变量第 {index} 行").fill(value)
    page.get_by_role("textbox", name="循环初始化").fill("fast = 0")
    page.get_by_role("textbox", name="循环条件").fill("fast < len")
    page.get_by_role("textbox", name="循环前进").fill("fast++")
    page.get_by_role("textbox", name="有货判断").fill("nums[fast] != 0")
    swap = [
        "int tmp = nums[slow]",
        "nums[slow] = nums[fast]",
        "nums[fast] = tmp",
    ]
    for index, value in enumerate(swap, start=1):
        page.get_by_role("textbox", name=f"交换货物第 {index} 行").fill(value)
    if include_slow_update:
        page.get_by_role("textbox", name="装载手前进").fill("slow++")


def assert_custom_structure_preserved(page):
    expect(page.get_by_role("textbox", name="准备变量第 1 行")).to_have_value(
        "int len = nums.length"
    )
    expect(page.get_by_role("textbox", name="循环初始化")).to_have_value("fast = 0")
    expect(page.get_by_role("textbox", name="循环条件")).to_have_value("fast < len")
    expect(page.get_by_role("textbox", name="有货判断")).to_have_value(
        "nums[fast] != 0"
    )
    expect(page.get_by_role("textbox", name="交换货物第 1 行")).to_have_value(
        "int tmp = nums[slow]"
    )
    expect(page.get_by_role("textbox", name="装载手前进")).to_have_value("slow++")


def assert_static_dictionary(page):
    page.get_by_role("tab", name="代码词典").click()
    expected = {
        "装载手": "int writeIndex",
        "扫描手": "int scanIndex",
        "数组访问": "nums[scanIndex]",
        "变量声明": "int temp;",
        "数组 length": "nums.length",
    }
    for entry, code in expected.items():
        page.get_by_role("button", name=entry, exact=True).click()
        expect(page.locator(".mapping-detail code")).to_have_text(code)
    page.get_by_role("tab", name="逻辑代码").click()


def run_desktop(browser):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=ORIGIN)
    page = context.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{BASE_URL}?stage=code")
    page.wait_for_load_state("networkidle")
    page.evaluate(
        """
        () => {
          localStorage.clear();
          localStorage.setItem('zero-warehouse:v2:java-code-draft', 'old answer');
        }
        """
    )
    page.reload()
    page.wait_for_load_state("networkidle")

    expect(page.get_by_role("heading", name="把刚才的动作写下来")).to_be_visible()
    expect(page.get_by_role("radio", name="结构填写")).to_be_checked()
    expect(page.get_by_role("radio", name="自由编写")).not_to_be_checked()
    expect(page.locator(".structured-code-frame")).to_be_visible()
    expect(page.locator(".code-editor-frame")).to_have_count(0)
    expect(page.locator("[data-slot-id]")).to_have_count(7)
    assert page.locator(".structured-code-frame input").evaluate_all(
        "nodes => nodes.every(node => !node.hasAttribute('placeholder'))"
    )
    expect(page.locator(".structured-code-frame")).to_contain_text(
        "void moveZeroes(int[] nums) {"
    )
    expect(page.locator(".structured-code-frame")).to_contain_text("for (")
    expect(page.locator(".structured-code-frame")).to_contain_text("if (")
    expect(page.locator(".structured-code-line.is-locked-line")).to_have_count(2)
    expect(
        page.locator(".structured-statement-line .structured-fixed-token")
    ).to_have_count(6)
    expect(page.locator(".parse-status")).to_contain_text("按顺序填写 7 个逻辑槽位")
    expect(page.locator(".parse-status")).to_have_class("parse-status is-empty")
    expect(page.locator(".structured-statement-slot.is-invalid")).to_have_count(0)
    assert_reference_complete(page)
    expect(page.locator(".logic-progress")).to_have_text("0/7")

    page.get_by_role("button", name="提交全部用例").click()
    expect(page.locator(".parse-status")).to_contain_text("待填写")
    expect(page.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    assert (
        page.evaluate("document.activeElement?.getAttribute('aria-label')")
        == "准备变量第 1 行"
    )

    preparation_field = page.get_by_role("textbox", name="准备变量第 1 行")
    preparation_field.press_sequentially("int len = nums.length")
    expect(preparation_field).to_have_value("int len = nums.length")
    fill_custom_structure(page, include_slow_update=False)
    assert_reference_complete(page)
    page.get_by_role("textbox", name="装载手前进").fill("slow++")
    assert_reference_complete(page)
    page.get_by_role("textbox", name="装载手前进").fill("slow+")
    assert_reference_complete(page)
    page.get_by_role("textbox", name="装载手前进").fill("slow++")
    assert_static_dictionary(page)
    page.locator('[data-step-id="open-scan-loop"]').get_by_role(
        "button", name="复制代码段：", exact=False
    ).click()
    assert page.evaluate("navigator.clipboard.readText()") == (
        "for (int scanIndex = 0; scanIndex < nums.length; scanIndex++) {"
    )
    expect(page.locator(".parse-status")).to_contain_text(
        "结构与双指针逻辑已经连通"
    )
    expect(page.locator(".logic-progress")).to_have_text("7/7")
    page.get_by_role("button", name="运行当前用例").click()
    expect(page.locator(".code-run-result strong")).to_have_text("用例通过")
    page.get_by_role("button", name="提交全部用例").click()
    celebration = page.get_by_role("dialog", name="关卡通关")
    expect(celebration).to_be_visible()
    expect(celebration.get_by_label("8 / 8 个公开与隐藏用例通过")).to_be_visible()
    celebration.get_by_role("button", name="重播通关动画").click()
    expect(celebration).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(page.get_by_text("全部用例通过", exact=False)).to_be_visible()
    expect(page.locator(".submission-result")).to_contain_text("8 / 8")
    page.get_by_role("button", name="提交全部用例").click()
    expect(page.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(page.locator(".submission-result")).to_contain_text("8 / 8")
    assert_no_horizontal_overflow(page)
    page.screenshot(
        path=OUTPUTS / "zero-warehouse-v2-code-structured-desktop.png",
        full_page=True,
    )

    page.wait_for_timeout(450)
    page.reload()
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(page.get_by_role("radio", name="结构填写")).to_be_checked()
    assert_custom_structure_preserved(page)
    assert_reference_complete(page)

    page.get_by_role("radio", name="自由编写").click()
    expect(page.locator(".code-editor-frame")).to_be_visible()
    assert editor_value(page) == ""
    assert_reference_complete(page)
    assembled = assemble_from_copied_steps(page)
    page.get_by_role("button", name="提交全部用例").click()
    expect(page.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(page.locator(".submission-result")).to_contain_text("8 / 8")

    page.locator(".cm-content").fill(CUSTOM_BODY)
    assert_reference_complete(page)
    assert_static_dictionary(page)
    page.get_by_role("button", name="提交全部用例").click()
    expect(page.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(page.locator(".submission-result")).to_contain_text("8 / 8")

    page.wait_for_timeout(450)
    page.reload()
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(page.get_by_role("radio", name="自由编写")).to_be_checked()
    assert editor_value(page).startswith("int len = nums.length;")
    assert_reference_complete(page)
    page.get_by_role("radio", name="结构填写").click()
    assert_custom_structure_preserved(page)

    page.get_by_role("radio", name="自由编写").click()
    hidden_failure = CUSTOM_BODY.replace("fast < len", "fast < 5")
    page.locator(".cm-content").fill(hidden_failure)
    page.get_by_role("button", name="提交全部用例").click()
    expect(page.get_by_role("dialog", name="关卡通关")).to_have_count(0)
    expect(page.locator(".submission-result")).to_contain_text("3 / 8")
    expect(page.locator(".submission-result")).to_contain_text("隐藏用例未通过")
    page.get_by_role("button", name="重置当前模式").click()
    expect(page.locator(".cm-content")).to_have_text("")
    page.get_by_role("radio", name="结构填写").click()
    assert_custom_structure_preserved(page)

    page.get_by_role("button", name="重置当前模式").click()
    expect(page.get_by_role("textbox", name="准备变量第 1 行")).to_have_value("")
    expect(page.locator(".parse-status")).to_have_class("parse-status is-empty")
    expect(page.locator(".structured-statement-slot.is-invalid")).to_have_count(0)
    page.get_by_role("radio", name="自由编写").click()
    expect(page.locator(".cm-content")).to_have_text("")

    page.get_by_role("tab", name="代码词典").click()
    expect(page.get_by_role("region", name="场景对象")).to_be_visible()
    expect(page.get_by_role("region", name="语法结构")).to_be_visible()
    expect(page.get_by_role("region", name="数据结构 / API")).to_be_visible()
    page.get_by_role("button", name="数组 length").click()
    expect(page.locator(".mapping-detail code")).to_have_text("nums.length")
    page.get_by_role("tab", name="逻辑代码").click()
    assert_reference_complete(page)

    assert_no_horizontal_overflow(page)
    assert not errors, errors
    page.close()
    context.close()


def run_mobile(browser):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=1,
        has_touch=True,
        is_mobile=True,
        reduced_motion="reduce",
    )
    page = context.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{BASE_URL}?stage=code")
    page.wait_for_load_state("networkidle")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_load_state("networkidle")

    expect(page.get_by_role("button", name="参考")).to_have_attribute(
        "aria-pressed", "true"
    )
    expect(page.locator(".code-mapping-panel")).to_be_visible()
    expect(page.locator(".code-editor-panel")).not_to_be_visible()
    assert_reference_complete(page)
    assert_no_horizontal_overflow(page)

    page.get_by_role("button", name="编辑", exact=True).click()
    expect(page.locator(".code-editor-panel")).to_be_visible()
    expect(page.locator(".code-mapping-panel")).not_to_be_visible()
    expect(page.get_by_role("radio", name="结构填写")).to_be_checked()
    assert page.locator(".structured-method-body").bounding_box()["height"] >= 430
    assert_no_horizontal_overflow(page)
    page.screenshot(
        path=OUTPUTS / "zero-warehouse-v2-code-structured-mobile.png",
        full_page=True,
    )

    page.get_by_role("radio", name="自由编写").click()
    expect(page.locator(".code-editor-frame .cm-editor")).to_be_visible()
    assert page.locator(".code-editor-frame .cm-editor").bounding_box()["height"] >= 390
    assert_no_horizontal_overflow(page)

    page.locator(".cm-content").fill(CUSTOM_BODY)
    page.get_by_role("button", name="提交全部用例").click()
    celebration = page.get_by_role("dialog", name="关卡通关")
    expect(celebration).to_be_visible()
    expect(celebration.get_by_label("8 / 8 个公开与隐藏用例通过")).to_be_visible()
    assert celebration.locator(".sp-completion__verdict").evaluate(
        "node => getComputedStyle(node).opacity"
    ) == "1"
    assert celebration.locator(".sp-completion__verdict").evaluate(
        "node => getComputedStyle(node).animationName"
    ) == "none"
    assert_no_horizontal_overflow(page)
    page.screenshot(
        path=OUTPUTS / "zero-warehouse-completion-mobile-reduced.png",
    )
    celebration.get_by_role("button", name="跳过通关动画").click()
    expect(page.locator(".submission-result")).to_contain_text("8 / 8")

    page.get_by_role("button", name="参考", exact=True).click()
    expect(page.locator(".logic-reference-step")).to_have_count(7)
    assert not errors, errors
    page.close()
    context.close()


with sync_playwright() as playwright:
    chromium = playwright.chromium.launch(headless=True)
    run_desktop(chromium)
    run_mobile(chromium)
    chromium.close()
    print(
        "CODE_PRACTICE_QA_PASS locked-structure canonical-reference custom-identifiers "
        "dual-drafts active-reset completion mobile reduced-motion"
    )

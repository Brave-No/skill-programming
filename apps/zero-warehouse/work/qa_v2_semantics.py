from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"
BASE_URL = "http://127.0.0.1:5173/v2"


def complete_manual(page):
    page.get_by_role("button", name="1 号货位，货箱 4").click()
    page.get_by_role("button", name="0 号空货位").click()
    page.get_by_role("button", name="3 号货位，货箱 2").click()
    page.get_by_role("button", name="1 号空货位").click()
    page.get_by_role("button", name="交给机器人").click()
    expect(page.get_by_role("heading", name="让机器人处理未知批次")).to_be_visible()


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


def place_skill(page, library_name, scope, position):
    page.get_by_role("button", name=f"取用技能：{library_name}").click()
    scope.get_by_role(
        "button", name=f"放到当前作用域第 {position} 个位置", exact=True
    ).click()


def assemble_valid_program(page):
    root = page.locator('[data-scope-id="root"]')

    place_skill(page, "定位装载标记", root, 1)
    page.get_by_label("选择装载标记的货位").select_option("0")

    place_skill(page, "逐个遍历", root, 2)
    page.get_by_label("选择遍历对象").select_option("warehouse-slots")
    loop_item = page.locator('[data-scope-item]:has(.v2-card-type:text-is("遍历"))')
    loop_scope_id = loop_item.get_attribute("data-instance-id")
    loop_scope = page.locator(f'[data-scope-id="{loop_scope_id}"]')

    place_skill(page, "条件判断", loop_scope, 1)
    page.get_by_label("选择判断对象").select_option("current-slot")
    condition_item = loop_scope.locator(
        '[data-scope-item]:has(.v2-card-type:text-is("如果有货"))'
    )
    condition_scope_id = condition_item.get_attribute("data-instance-id")
    condition_scope = page.locator(f'[data-scope-id="{condition_scope_id}"]')

    place_skill(page, "交换位置", condition_scope, 1)
    page.get_by_label("选择第一个交换位置").select_option("current-slot")
    page.get_by_label("选择第二个交换位置").select_option("write-pointer")

    place_skill(page, "移动装载标记", condition_scope, 2)
    page.get_by_label("选择要移动的标记").select_option("write-pointer")
    expect(page.get_by_text("规则可以执行", exact=True)).to_be_visible()


def verify_previews(page):
    cases = [
        ("定位装载标记", "set-write", "装载手来到目标货位上方", ".load-robot.is-setting"),
        ("逐个遍历", "for-each", "扫描手依次经过全部货位", ".fast-scan-robot.is-preview-scanning"),
        ("条件判断", "if-occupied", "扫描手检查当前货位是否有货", ".fast-scan-robot.is-checking"),
        ("交换位置", "swap", "扫描手取箱投递，装载手接箱落位", ".dual-transfer-cargo.is-preview-transfer"),
        ("移动装载标记", "advance-write", "装载手向前移动一个货位", ".load-robot.is-advancing"),
    ]
    expect(page.locator(".v2-library-preview")).to_have_count(5)
    for label, preview_type, message, visual_selector in cases:
        page.get_by_role("button", name=f"预演技能：{label}").click()
        expect(page.locator(f".warehouse-board.preview-{preview_type}")).to_be_visible()
        expect(page.get_by_text(f"技能预演：{message}。", exact=True)).to_be_visible()
        expect(page.locator(visual_selector)).to_be_visible()
        expect(page.locator(".v2-scope-item")).to_have_count(0)


def step_until(page, target_text, max_steps=40):
    target = page.get_by_text(target_text, exact=True)
    for _ in range(max_steps):
        if target.is_visible():
            return
        step = page.get_by_role("button", name="单步展示规则")
        expect(step).to_be_enabled()
        step.click()
        page.wait_for_timeout(45)
    raise AssertionError(f"Did not reach state: {target_text}")


def desktop_flow(browser):
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on(
        "console",
        lambda msg: errors.append(f"console:{msg.type}:{msg.text}")
        if msg.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    complete_manual(page)
    verify_previews(page)
    assemble_valid_program(page)

    page.get_by_role("button", name="连续展示规则").click()
    page.wait_for_timeout(820)
    page.get_by_role("button", name="暂停执行展示").click()
    paused_step = page.locator(".frame-counter").inner_text()
    page.wait_for_timeout(820)
    assert page.locator(".frame-counter").inner_text() == paused_step
    expect(page.get_by_role("button", name="预演技能：定位装载标记")).to_be_disabled()
    page.get_by_role("button", name="重置当前批次").click()

    page.get_by_role("button", name="单步展示规则").click()
    expect(page.locator(".load-robot:not(.is-idle)")).to_be_visible()
    expect(page.get_by_role("button", name="预演技能：定位装载标记")).to_be_disabled()
    page.get_by_role("button", name="重置当前批次").click()
    expect(page.get_by_role("button", name="预演技能：定位装载标记")).to_be_enabled()

    step_until(page, "1 号位与 0 号位完成交换。")
    expect(page.locator(".dual-transfer-cargo.is-runtime-transfer")).to_be_visible()
    expect(page.locator(".fast-scan-robot.is-throwing")).to_be_visible()
    expect(page.locator(".load-robot.is-catching")).to_be_visible()
    page.wait_for_timeout(230)
    page.screenshot(path=OUTPUTS / "zero-warehouse-v2-transfer.png", full_page=True)

    step_until(page, "本批货物整理完成。")
    page.get_by_role("button", name="下一批").click()
    step_until(page, "两个标记都在 0 号位，货箱保持原位。")
    expect(page.locator(".dual-same-position-badge")).to_be_visible()
    expect(page.locator(".dual-transfer-cargo")).to_have_count(0)
    page.screenshot(path=OUTPUTS / "zero-warehouse-v2-same-position.png", full_page=True)

    page.get_by_role("button", name="重置当前批次").click()
    page.get_by_role("button", name="校验全部批次").click()
    expect(page.get_by_text("规则通过全部批次", exact=True)).to_be_visible()
    page.get_by_role("button", name="进入代码实战").click()
    expect(page.get_by_role("heading", name="把刚才的动作写下来")).to_be_visible()
    page.get_by_role("button", name="返回技能调试").click()
    expect(page.get_by_role("heading", name="让机器人处理未知批次")).to_be_visible()

    assert_no_horizontal_overflow(page)
    page.screenshot(path=OUTPUTS / "zero-warehouse-v2-desktop.png", full_page=True)
    assert not errors, errors
    page.close()


def mobile_flow(browser):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=1,
        has_touch=True,
        is_mobile=True,
    )
    page = context.new_page()
    errors = []
    page.on(
        "console",
        lambda msg: errors.append(f"console:{msg.type}:{msg.text}")
        if msg.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    complete_manual(page)
    page.get_by_role("button", name="预演技能：交换位置").click()
    expect(page.locator(".warehouse-board.preview-swap")).to_be_visible()
    expect(page.locator(".dual-transfer-cargo.is-preview-transfer")).to_be_visible()
    load_box = page.locator(".load-robot").bounding_box()
    cargo_box = page.locator(".cargo-zone").bounding_box()
    scan_box = page.locator(".fast-scan-robot").bounding_box()
    assert load_box["y"] < cargo_box["y"] < scan_box["y"], (load_box, cargo_box, scan_box)
    page.wait_for_timeout(520)
    assert_no_horizontal_overflow(page)
    page.screenshot(path=OUTPUTS / "zero-warehouse-v2-mobile.png", full_page=True)
    assert not errors, errors
    page.close()
    context.close()


with sync_playwright() as playwright:
    chromium = playwright.chromium.launch(headless=True)
    desktop_flow(chromium)
    mobile_flow(chromium)
    chromium.close()
    print("V2_SEMANTICS_QA_PASS desktop-preview runtime-marker mobile-layout")

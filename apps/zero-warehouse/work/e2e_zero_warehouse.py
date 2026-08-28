import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"
BASE_URL = os.environ.get("ZERO_WAREHOUSE_V1_URL", "http://127.0.0.1:5173/v1")


def complete_manual(page):
    page.get_by_role("button", name="1 号货位，货箱 4").click()
    page.get_by_role("button", name="0 号空货位").click()
    page.get_by_role("button", name="3 号货位，货箱 2").click()
    page.get_by_role("button", name="1 号空货位").click()
    expect(page.get_by_text("货位整理正确。")).to_be_visible()
    page.get_by_role("button", name="交给机器人").click()
    expect(page.get_by_role("heading", name="让机器人处理未知批次")).to_be_visible()


def verify_manual_error_and_undo(page):
    page.get_by_role("button", name="3 号货位，货箱 2").click()
    page.get_by_role("button", name="0 号空货位").click()
    expect(page.get_by_text("货箱靠左了，但原有顺序发生了变化。")).to_be_visible()
    page.get_by_role("button", name="撤销上一步").click()
    expect(page.get_by_text("选择或拖动一个货箱。")).to_be_visible()


def drag_block(page, label, container_id, index):
    source = page.get_by_role("button", name=f"拖动：{label}")
    target = page.locator(
        f'[data-container="{container_id}"][data-index="{index}"]'
    )
    expect(source).to_be_visible()
    expect(target).to_be_visible()
    source_box = source.bounding_box()
    target_box = target.bounding_box()
    page.mouse.move(
        source_box["x"] + source_box["width"] / 2,
        source_box["y"] + source_box["height"] / 2,
    )
    page.mouse.down()
    page.mouse.move(
        target_box["x"] + target_box["width"] / 2,
        target_box["y"] + target_box["height"] / 2,
        steps=14,
    )
    page.mouse.up()
    page.wait_for_timeout(180)


def drag_program_block_to_shelf(page, label):
    source = page.get_by_role("button", name=f"拖动：{label}")
    target = page.locator(".v1-shelf-list")
    source_box = source.bounding_box()
    target_box = target.bounding_box()
    page.mouse.move(
        source_box["x"] + source_box["width"] / 2,
        source_box["y"] + source_box["height"] / 2,
    )
    page.mouse.down()
    page.mouse.move(
        target_box["x"] + target_box["width"] / 2,
        target_box["y"] + target_box["height"] / 2,
        steps=18,
    )
    page.mouse.up()
    page.wait_for_timeout(180)


def assemble_correct_program(page):
    page.get_by_role("button", name="装载标记放到 0 号位", exact=True).click()
    page.get_by_role("button", name="放到主规则的第 1 个位置").click()
    drag_block(page, "扫描每个货位", "root", 1)
    drag_block(page, "如果扫描位有货", "block-for-each", 0)
    drag_block(page, "装载标记前进一步", "block-if-occupied", 0)
    drag_block(page, "交换扫描位与装载位", "block-if-occupied", 0)
    expect(page.locator(".v1-shelf-empty")).to_contain_text("动作已全部取出")
    expect(page.locator(".v1-block-card")).to_have_count(5)

    # Move an existing instruction within the same nested list, then restore it.
    drag_block(page, "装载标记前进一步", "block-if-occupied", 0)
    nested_labels = page.locator(
        '.v1-block-children .v1-block-children > .v1-rule-list > .v1-block > .v1-block-card .v1-block-select'
    ).all_inner_texts()
    assert nested_labels == ["装载标记前进一步", "交换扫描位与装载位"]
    drag_block(page, "交换扫描位与装载位", "block-if-occupied", 0)

    drag_program_block_to_shelf(page, "装载标记放到 0 号位")
    expect(page.get_by_role("button", name="装载标记放到 0 号位", exact=True)).to_be_visible()
    page.get_by_role("button", name="装载标记放到 0 号位", exact=True).click()
    page.get_by_role("button", name="放到主规则的第 1 个位置").click()


def step_until(page, target_text, max_steps=30):
    target = page.get_by_text(target_text, exact=True)
    for _ in range(max_steps):
        if target.is_visible():
            return
        step = page.get_by_role("button", name="执行下一步")
        expect(step).to_be_enabled()
        step.click()
        page.wait_for_timeout(45)
    raise AssertionError(f"Did not reach state: {target_text}")


def assert_no_horizontal_overflow(page):
    overflow = page.evaluate(
        """
        () => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        })
        """
    )
    assert overflow["scrollWidth"] <= overflow["clientWidth"] + 1, overflow


def verify_play_pause_reset(page):
    page.get_by_role("button", name="播放规则").click()
    page.wait_for_timeout(850)
    page.get_by_role("button", name="暂停执行").click()
    frozen_step = page.locator(".frame-counter").inner_text()
    page.wait_for_timeout(850)
    assert page.locator(".frame-counter").inner_text() == frozen_step
    expect(page.get_by_text("重置当前批次后可继续编辑")).to_be_visible()
    page.get_by_role("button", name="重置当前批次").click()
    expect(page.get_by_text("机器人待命，等待一套可执行的规则。")).to_be_visible()


def touch_drag(page, source, target):
    source.scroll_into_view_if_needed()
    target.scroll_into_view_if_needed()
    source_box = source.bounding_box()
    target_box = target.bounding_box()
    start_x = source_box["x"] + source_box["width"] / 2
    start_y = source_box["y"] + source_box["height"] / 2
    end_x = target_box["x"] + target_box["width"] / 2
    end_y = target_box["y"] + target_box["height"] / 2
    session = page.context.new_cdp_session(page)
    session.send("Input.dispatchTouchEvent", {
        "type": "touchStart",
        "touchPoints": [{"x": start_x, "y": start_y}],
    })
    page.wait_for_timeout(160)
    for step in range(1, 13):
        ratio = step / 12
        session.send("Input.dispatchTouchEvent", {
            "type": "touchMove",
            "touchPoints": [{
                "x": start_x + (end_x - start_x) * ratio,
                "y": start_y + (end_y - start_y) * ratio,
            }],
        })
        page.wait_for_timeout(18)
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(220)
    session.detach()


def desktop_flow(browser):
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    errors = []
    page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="先亲手整理一批货")).to_be_visible()
    page.screenshot(path=OUTPUTS / "zero-warehouse-manual.png", full_page=True)
    assert_no_horizontal_overflow(page)

    verify_manual_error_and_undo(page)
    complete_manual(page)
    assemble_correct_program(page)
    page.get_by_role("button", name="交换扫描位与装载位", exact=True).click()
    page.screenshot(path=OUTPUTS / "zero-warehouse-rules.png", full_page=True)
    page.get_by_role("button", name="取消选择").click()
    verify_play_pause_reset(page)

    step_until(page, "本批货物整理完成。")
    expect(page.get_by_role("button", name="下一批")).to_be_visible()
    page.get_by_role("button", name="下一批").click()

    step_until(page, "本批货物整理完成。")
    expect(page.get_by_role("button", name="下一批")).to_be_visible()
    page.get_by_role("button", name="下一批").click()

    step_until(page, "规则通过全部批次")
    expect(page.get_by_text("同一套动作完成了三批不同货物。")).to_be_visible()
    assert_no_horizontal_overflow(page)
    page.screenshot(path=OUTPUTS / "zero-warehouse-complete.png", full_page=True)
    assert not errors, errors
    page.close()


def mobile_visual(browser):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=1,
        has_touch=True,
        is_mobile=True,
    )
    page = context.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    assert_no_horizontal_overflow(page)
    complete_manual(page)
    expect(page.locator(".warehouse-board")).to_be_visible()
    page.wait_for_timeout(520)
    source = page.get_by_role("button", name="拖动：装载标记放到 0 号位")
    target = page.locator('[data-container="root"][data-index="0"]')
    touch_drag(page, source, target)
    expect(page.locator(".v1-block-card", has_text="装载标记放到 0 号位")).to_be_visible()
    assert_no_horizontal_overflow(page)
    page.screenshot(path=OUTPUTS / "zero-warehouse-mobile.png", full_page=True)
    assert not errors, errors
    page.close()
    context.close()


with sync_playwright() as playwright:
    chromium = playwright.chromium.launch(headless=True)
    desktop_flow(chromium)
    mobile_visual(chromium)
    chromium.close()
    print("E2E_PASS desktop-flow mobile-layout console-clean")

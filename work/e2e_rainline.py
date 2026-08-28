from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5174/games/rainline/"
OUTPUTS = Path(__file__).resolve().parents[1] / "outputs"


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


def complete_observation(page) -> None:
    for index, height in ((1, 0), (2, 2), (3, 0)):
        page.get_by_role(
            "button", name=f"标记 {index} 号位置，高度 {height}"
        ).click()
    page.get_by_role("button", name="降雨验证").click()
    page.get_by_text("判断准确", exact=True).wait_for()


def place_skill(page, label: str, position: str) -> None:
    page.get_by_role("button", name=f"选择技能：{label}").click()
    page.get_by_role("button", name=position, exact=True).click()


def assemble_stalled_program(page) -> None:
    place_skill(page, "双端就位", "主流程第 1 个放置位置")
    place_skill(page, "巡检直到相遇", "主流程第 2 个放置位置")
    place_skill(page, "选择较低岸线", "巡检循环第 1 个放置位置")
    place_skill(page, "计算当前积水", "巡检循环第 2 个放置位置")


def assemble_correct_program(page) -> None:
    assemble_stalled_program(page)
    add_advance_to_loop(page)
    add_update_max_to_loop(page)


def add_advance_to_loop(page) -> None:
    add_button = page.locator('button[aria-label="选择技能：低岸向内一步"]')
    add_button.wait_for(state="visible")
    add_button.click()
    page.get_by_role("button", name="巡检循环第 2 个放置位置").click()


def add_update_max_to_loop(page) -> None:
    place_skill(page, "更新最高柱", "巡检循环第 3 个放置位置")


def verify_shelf_drag_from_empty_state(page) -> None:
    source = page.get_by_role("button", name="取用技能：低岸向内一步")
    source.scroll_into_view_if_needed()
    source_box = source.bounding_box()
    assert source_box is not None
    target = page.get_by_role("button", name="主流程第 1 个放置位置")
    target_box = target.bounding_box()
    assert target_box is not None
    page.mouse.move(
        source_box["x"] + source_box["width"] / 2,
        source_box["y"] + source_box["height"] / 2,
    )
    page.mouse.down()
    page.mouse.move(source_box["x"] + 18, source_box["y"] + 18, steps=4)
    page.locator(".drag-overlay").wait_for(state="visible")
    for _ in range(8):
        target_x = target_box["x"] + target_box["width"] / 2
        target_y = target_box["y"] + target_box["height"] / 2
        page.mouse.move(target_x, target_y, steps=6)
        page.wait_for_timeout(220)
        if "is-over" in (target.get_attribute("class") or ""):
            break
    page.mouse.up()
    page.locator(".drag-overlay").wait_for(state="hidden")
    assert page.locator("[data-program-node]").count() == 1
    page.get_by_role("button", name="删除技能：低岸向内一步").click()
    assert page.locator("[data-program-node]").count() == 0


def wait_for_batch_success(page, total: int) -> None:
    page.get_by_role("button", name="播放巡检").click()
    page.get_by_text(f"整段地形共记录 {total} 格雨水。").wait_for(timeout=25000)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    errors: list[str] = []

    desktop = browser.new_page(viewport={"width": 1440, "height": 1000})
    desktop.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    desktop.on("pageerror", lambda error: errors.append(str(error)))
    desktop.goto(BASE_URL)
    desktop.wait_for_load_state("networkidle")
    desktop.get_by_role("heading", name="雨线峡谷").wait_for()
    assert_no_overflow(desktop, "desktop observation")
    desktop.screenshot(path=OUTPUTS / "rainline-observe-desktop.png", full_page=True)

    desktop.get_by_role("button", name="标记 0 号位置，高度 3").click()
    desktop.get_by_role("button", name="降雨验证").click()
    desktop.get_by_text("标记与实际水位不同", exact=True).wait_for()
    desktop.get_by_role("button", name="取消标记 0 号位置，高度 3").click()
    complete_observation(desktop)
    desktop.screenshot(path=OUTPUTS / "rainline-observe-result-desktop.png", full_page=True)
    desktop.get_by_role("button", name="进入巡检台").click()
    desktop.get_by_role("heading", name="巡检技能").wait_for()

    assert desktop.locator("[data-program-node]").count() == 0
    desktop.get_by_text("从技能架选择第一项", exact=True).wait_for()
    assert desktop.get_by_role("button", name="播放巡检").is_disabled()
    assert desktop.get_by_role("button", name="校验全部批次").is_disabled()
    assert desktop.get_by_role("button", name="恢复初始挑战").count() == 0
    verify_shelf_drag_from_empty_state(desktop)

    assemble_stalled_program(desktop)
    desktop.get_by_role("button", name="校验全部批次").click()
    desktop.get_by_text("3 段地形未通过", exact=True).wait_for()
    desktop.get_by_text(
        "第 1 段：低岸巡线员还没有向内移动，当前位置不能计算积水。",
        exact=True,
    ).wait_for()
    desktop.get_by_role("button", name="查看第 1 段执行").click()
    desktop.get_by_role("button", name="播放巡检").click()
    desktop.wait_for_timeout(700)
    desktop.get_by_role("button", name="暂停巡检").click()
    paused_counter = desktop.locator(".frame-counter").inner_text()
    desktop.wait_for_timeout(700)
    assert desktop.locator(".frame-counter").inner_text() == paused_counter
    desktop.get_by_role("button", name="播放巡检").click()
    desktop.get_by_text("低岸巡线员还没有向内移动，当前位置不能计算积水。").wait_for(
        timeout=8000
    )
    add_advance_to_loop(desktop)
    desktop.get_by_role("button", name="校验全部批次").click()
    desktop.get_by_text(
        "第 1 段：当前柱还没有和本侧最高柱比较并更新，暂时不能计算积水。",
        exact=True,
    ).wait_for()
    add_update_max_to_loop(desktop)
    assert desktop.locator('[data-program-node]').count() == 6
    desktop.screenshot(path=OUTPUTS / "rainline-program-desktop.png", full_page=True)

    desktop.get_by_role("button", name="校验全部批次").click()
    desktop.get_by_text("全部地形已直接校验通过。", exact=True).wait_for()
    code_stage = desktop.locator(".stage-tabs button").filter(has_text="代码实战")
    assert code_stage.is_enabled()
    desktop.get_by_role("button", name="删除技能：更新最高柱").click()
    assert code_stage.is_disabled()
    assert desktop.get_by_text("全部地形已直接校验通过。", exact=True).count() == 0
    add_update_max_to_loop(desktop)
    desktop.get_by_role("button", name="校验全部批次").click()
    desktop.get_by_text("全部地形已直接校验通过。", exact=True).wait_for()
    assert code_stage.is_enabled()
    desktop.get_by_role("button", name="重新验证").click()
    assert code_stage.is_disabled()

    wait_for_batch_success(desktop, 9)
    desktop.get_by_role("button", name="下一段地形").click()
    wait_for_batch_success(desktop, 8)
    desktop.get_by_role("button", name="下一段地形").click()
    wait_for_batch_success(desktop, 14)
    desktop.get_by_text("全部地形巡检完成", exact=True).wait_for()
    assert_no_overflow(desktop, "desktop completion")
    desktop.screenshot(path=OUTPUTS / "rainline-complete-desktop.png", full_page=True)

    mobile = browser.new_page(
        viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
    )
    mobile.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.goto(BASE_URL)
    mobile.wait_for_load_state("networkidle")
    complete_observation(mobile)
    mobile.get_by_role("button", name="进入巡检台").tap()
    assemble_correct_program(mobile)
    mobile.get_by_role("button", name="单步巡检").tap()
    mobile.get_by_text(
        "左右巡线员就位：左岸最高柱是 0 号，高 4；右岸最高柱是 5 号，高 5。"
    ).wait_for()
    assert mobile.locator(".shore-readout .is-left strong").inner_text() == "4"
    assert mobile.locator(".shore-readout .is-right strong").inner_text() == "5"
    assert mobile.locator('[data-concept-id="left-maximum"]').count() >= 2
    assert mobile.locator('[data-concept-id="right-maximum"]').count() >= 2
    for _ in range(3):
        mobile.get_by_role("button", name="单步巡检").tap()
    mobile.get_by_text("左侧巡线员向内来到 1 号位置。").wait_for()
    assert mobile.locator(
        'button[aria-label^="5 号位置"] .scout-position--right'
    ).count() == 1
    assert mobile.locator(
        'button[aria-label^="4 号位置"] .scout-position--right'
    ).count() == 0
    mobile.get_by_role("button", name="单步巡检").tap()
    mobile.get_by_text(
        "1 号柱高 2，没有超过左岸最高柱 4；仍记住 0 号柱。",
        exact=True,
    ).wait_for()
    assert mobile.locator(
        'button[aria-label^="0 号位置"] .maximum-source-markers .is-left'
    ).count() == 1
    mobile.get_by_role("button", name="单步巡检").tap()
    mobile.get_by_text(
        "左岸最高柱 4 - 1 号柱高 2 = 当前积水 2 格；累计 2 格。",
        exact=True,
    ).wait_for()
    assert_no_overflow(mobile, "mobile program")
    mobile.screenshot(path=OUTPUTS / "rainline-first-move-mobile.png", full_page=True)

    switched_to_right = False
    for _ in range(20):
        mobile.get_by_role("button", name="单步巡检").tap()
        if mobile.get_by_text("右侧巡线员向内来到 4 号位置。").is_visible():
            switched_to_right = True
            break
    assert switched_to_right
    assert mobile.locator(".shore-readout .is-left strong").inner_text() == "6"
    assert mobile.locator(".shore-readout .is-right strong").inner_text() == "5"
    assert mobile.locator(".shore-readout .is-left em").inner_text() == "3 号"
    assert mobile.locator(
        'button[aria-label^="3 号位置"] .maximum-source-markers .is-left'
    ).count() == 1
    assert mobile.locator(
        'button[aria-label^="3 号位置"] .scout-position--left'
    ).count() == 1
    assert mobile.locator(
        'button[aria-label^="4 号位置"] .scout-position--right'
    ).count() == 1
    assert mobile.locator(
        'button[aria-label^="4 号位置"] .scout-position--left'
    ).count() == 0
    mobile.screenshot(path=OUTPUTS / "rainline-summit-switch-mobile.png", full_page=True)
    mobile.get_by_role("button", name="重置当前批次").tap()
    mobile.get_by_text("巡检台等待执行。", exact=True).wait_for()

    assert errors == [], errors
    browser.close()

print("Rainline Valley E2E passed: observation, stalled rule, repair, 3 batches, mobile.")

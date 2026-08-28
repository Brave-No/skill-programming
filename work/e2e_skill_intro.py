import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


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


def enter_program_stage(page) -> None:
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    for index, height in ((1, 0), (2, 2), (3, 0)):
        page.get_by_role(
            "button", name=f"标记 {index} 号位置，高度 {height}"
        ).click()
    page.get_by_role("button", name="降雨验证").click()
    expect(page.get_by_text("判断准确", exact=True)).to_be_visible()
    page.get_by_role("button", name="进入巡检台").click()
    expect(page.get_by_role("heading", name="巡检技能")).to_be_visible()


def place_skill(page, label: str, position: str) -> None:
    page.get_by_role("button", name=f"选择技能：{label}").click()
    page.get_by_role("button", name=position, exact=True).click()


def assemble_correct_program(page) -> None:
    place_skill(page, "双端就位", "主流程第 1 个放置位置")
    place_skill(page, "巡检直到相遇", "主流程第 2 个放置位置")
    place_skill(page, "选择较低岸线", "巡检循环第 1 个放置位置")
    place_skill(page, "低岸向内一步", "巡检循环第 2 个放置位置")
    place_skill(page, "更新最高柱", "巡检循环第 3 个放置位置")
    place_skill(page, "计算当前积水", "巡检循环第 4 个放置位置")


def desktop_flow(browser) -> None:
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on(
        "console",
        lambda message: errors.append(f"console:{message.type}:{message.text}")
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    enter_program_stage(page)

    intro_buttons = page.get_by_role(
        "button", name=re.compile(r"^播放技能介绍短片：")
    )
    expect(intro_buttons).to_have_count(6)
    initial_program_count = page.locator("[data-program-node]").count()
    expect(page.locator(".frame-counter")).to_have_text("待命")

    cases = [
        ("双端就位", "deploy", ".skill-intro-scout--left"),
        ("巡检直到相遇", "patrol", ".skill-intro-loop"),
        ("选择较低岸线", "compare", ".skill-intro-decision"),
        ("低岸向内一步", "advance", ".skill-intro-scout--left"),
        ("更新最高柱", "update-max", ".skill-intro-maximum-badge"),
        ("计算当前积水", "collect", ".skill-intro-equation"),
    ]

    for label, skill_type, visual_selector in cases:
        page.get_by_role(
            "button", name=f"播放技能介绍短片：{label}"
        ).click()
        dialog = page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role("heading", name=label)).to_be_visible()
        expect(page.locator(f'[data-skill-intro="{skill_type}"]')).to_be_visible()
        expect(dialog.locator(visual_selector)).to_be_visible()
        expect(page.locator("[data-program-node]")).to_have_count(initial_program_count)
        expect(page.locator(".frame-counter")).to_have_text("待命")

        if skill_type == "collect":
            equation = dialog.locator(".skill-intro-equation")
            expect(equation).to_have_attribute(
                "aria-label",
                "左岸最高柱 4，减去当前柱高 2，等于积水深度 2 格",
            )
            expect(equation).to_contain_text("左岸最高柱4−当前柱高2=积水深度2 格")
            page.wait_for_timeout(1750)
            page.screenshot(
                path=OUTPUTS / "rainline-skill-intro-desktop.png", full_page=True
            )
            page.get_by_role("button", name="重新播放技能短片").click()
            expect(page.locator('[data-skill-intro="collect"]')).to_be_visible()

        page.get_by_role("button", name="关闭技能短片").click()
        expect(dialog).to_be_hidden()

    assemble_correct_program(page)
    page.get_by_role("button", name="播放巡检").click()
    expect(
        page.get_by_role("button", name="播放技能介绍短片：双端就位")
    ).to_be_disabled()
    page.get_by_role("button", name="暂停巡检").click()
    assert_no_overflow(page, "desktop")
    assert not errors, errors
    page.close()


def mobile_flow(browser) -> None:
    page = browser.new_page(viewport={"width": 390, "height": 844})
    enter_program_stage(page)
    page.get_by_role(
        "button", name="播放技能介绍短片：计算当前积水"
    ).click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    expect(page.locator('[data-skill-intro="collect"]')).to_be_visible()
    expect(dialog.locator(".skill-intro-equation")).to_contain_text(
        "左岸最高柱4−当前柱高2=积水深度2 格"
    )

    box = dialog.bounding_box()
    assert box is not None
    assert box["x"] >= 0 and box["x"] + box["width"] <= 390, box
    assert box["y"] >= 0 and box["y"] + box["height"] <= 844, box
    assert_no_overflow(page, "mobile intro")
    page.wait_for_timeout(1750)
    page.screenshot(path=OUTPUTS / "rainline-skill-intro-mobile.png", full_page=True)
    page.keyboard.press("Escape")
    expect(dialog).to_be_hidden()

    page.get_by_role(
        "button", name="播放技能介绍短片：更新最高柱"
    ).click()
    update_dialog = page.get_by_role("dialog")
    expect(page.locator('[data-skill-intro="update-max"]')).to_be_visible()
    expect(update_dialog.locator(".skill-intro-maximum-badge")).to_have_text("新最高柱")
    expect(update_dialog).to_contain_text("左岸最高柱 4 → 6")
    assert_no_overflow(page, "mobile update maximum intro")
    page.get_by_role("button", name="关闭技能短片").click()
    expect(update_dialog).to_be_hidden()
    assert_no_overflow(page, "mobile closed")
    page.close()


def main() -> None:
    OUTPUTS.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        desktop_flow(browser)
        mobile_flow(browser)
        browser.close()
    print("SKILL_INTRO_E2E_PASS six-previews state-isolation desktop mobile")


if __name__ == "__main__":
    main()

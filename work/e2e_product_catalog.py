from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://127.0.0.1:5174"
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


def assert_previews_loaded(page) -> None:
    previews = page.locator(".challenge-preview img")
    expect(previews).to_have_count(2)
    for index in range(previews.count()):
        assert previews.nth(index).evaluate(
            "image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0"
        )


def attach_error_capture(page, errors: list[str]) -> None:
    page.on(
        "console",
        lambda message: errors.append(f"console:{message.type}:{message.text}")
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    errors: list[str] = []

    desktop = browser.new_page(viewport={"width": 1440, "height": 1000})
    attach_error_capture(desktop, errors)
    desktop.goto(f"{BASE_URL}/")
    desktop.wait_for_load_state("networkidle")
    expect(desktop.get_by_role("heading", name="技能编程", exact=True)).to_be_visible()
    expect(desktop.locator("[data-challenge-id]")).to_have_count(2)
    assert_previews_loaded(desktop)
    assert_no_overflow(desktop, "desktop catalog")
    desktop.screenshot(path=OUTPUTS / "skill-programming-catalog-desktop.png", full_page=True)

    desktop.locator('[data-challenge-id="move-zeroes"]').click()
    desktop.wait_for_load_state("networkidle")
    expect(desktop).to_have_url(f"{BASE_URL}/games/zero-warehouse/")
    expect(desktop.get_by_role("heading", name="先亲手整理一批货")).to_be_visible()
    expect(desktop.get_by_role("button", name="挑战选择")).to_be_visible()
    assert_no_overflow(desktop, "desktop zero warehouse")
    desktop.get_by_role("button", name="挑战选择").click()
    desktop.wait_for_load_state("networkidle")
    expect(desktop).to_have_url(f"{BASE_URL}/")
    expect(
        desktop.locator('[data-challenge-id="move-zeroes"] .last-played')
    ).to_have_text("上次进入")

    desktop.locator('[data-challenge-id="trapping-rain-water"]').click()
    desktop.wait_for_load_state("networkidle")
    expect(desktop).to_have_url(f"{BASE_URL}/games/rainline/")
    expect(desktop.get_by_role("heading", name="雨线峡谷")).to_be_visible()
    expect(desktop.get_by_role("button", name="挑战选择")).to_be_visible()
    assert_no_overflow(desktop, "desktop rainline")
    desktop.get_by_role("button", name="挑战选择").click()
    desktop.wait_for_load_state("networkidle")
    expect(desktop).to_have_url(f"{BASE_URL}/")
    expect(
        desktop.locator('[data-challenge-id="trapping-rain-water"] .last-played')
    ).to_have_text("上次进入")

    desktop.goto(f"{BASE_URL}/games/rainline/?stage=code")
    desktop.wait_for_load_state("networkidle")
    expect(desktop.get_by_role("button", name="挑战选择")).to_be_visible()
    desktop.get_by_role("button", name="挑战选择").click()
    expect(desktop).to_have_url(f"{BASE_URL}/")

    desktop.goto(f"{BASE_URL}/games/zero-warehouse/?stage=code")
    desktop.wait_for_load_state("networkidle")
    expect(desktop.get_by_role("button", name="挑战选择")).to_be_visible()
    desktop.get_by_role("button", name="挑战选择").click()
    expect(desktop).to_have_url(f"{BASE_URL}/")

    mobile = browser.new_page(
        viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
    )
    attach_error_capture(mobile, errors)
    mobile.goto(f"{BASE_URL}/")
    mobile.wait_for_load_state("networkidle")
    expect(mobile.locator("[data-challenge-id]")).to_have_count(2)
    assert_previews_loaded(mobile)
    assert_no_overflow(mobile, "mobile catalog")
    mobile.screenshot(path=OUTPUTS / "skill-programming-catalog-mobile.png", full_page=True)

    mobile.locator('[data-challenge-id="trapping-rain-water"]').tap()
    mobile.wait_for_load_state("networkidle")
    expect(mobile.get_by_role("heading", name="雨线峡谷")).to_be_visible()
    expect(mobile.get_by_role("button", name="挑战选择")).to_be_visible()
    assert_no_overflow(mobile, "mobile rainline")
    mobile.get_by_role("button", name="挑战选择").tap()
    mobile.wait_for_load_state("networkidle")
    expect(mobile).to_have_url(f"{BASE_URL}/")

    assert errors == [], errors
    browser.close()

print("PRODUCT_CATALOG_E2E_PASS catalog routes returns desktop mobile")

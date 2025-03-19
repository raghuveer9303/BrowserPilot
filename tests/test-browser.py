# Create file test-browser.py
#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

async def main():
    print("Starting Playwright")
    async with async_playwright() as p:
        print("Launching browser")
        browser = await p.chromium.launch(headless=False)
        print("Creating page")
        page = await browser.new_page()
        print("Navigating to example.com")
        await page.goto('https://example.com')
        print("Taking screenshot")
        await page.screenshot(path="/tmp/screenshot.png")
        print("Waiting 60 seconds")
        await asyncio.sleep(60)
        print("Closing browser")
        await browser.close()

asyncio.run(main())
import sys
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Go to login page and wait for it to load
        page.goto("http://localhost:8000/login.html")
        page.wait_for_selector("#login")
        
        # Fill login form
        page.fill("#login", "Jh3ffth")
        page.fill("#senha", "Solo123")
        
        # Wait for navigation after clicking Entrar
        with page.expect_navigation():
            page.click("button[type='submit']")
            
        print("Logged in successfully. Current URL:", page.url)
        
        # Make sure we are on dashboard and the extrato is loaded
        page.wait_for_selector("#lista-rotinas-hoje section", timeout=10000)
        
        sections = page.query_selector_all("#lista-rotinas-hoje section")
        print(f"Total sections: {len(sections)}")
        
        for sec in sections:
            dia = sec.get_attribute("data-dia")
            header = sec.query_selector("header span:first-child").inner_text()
            print(f"--- Dia: {dia} ({header}) ---")
            cards = sec.query_selector_all("[data-mc-card]")
            for c in cards:
                title_el = c.query_selector(".mc-titulo")
                status = c.get_attribute("class")
                title = title_el.inner_text() if title_el else "Unknown"
                # also get any display:none
                is_visible = c.is_visible()
                print(f"  - [{status}] {title} (Visible: {is_visible})")
                
        browser.close()

if __name__ == "__main__":
    run()
